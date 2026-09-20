// Video generation via OpenRouter's async /videos API.
//   POST /api/v1/videos -> 202 { id, polling_url, status: "pending" }
//   GET polling_url ... until { status: "completed", unsigned_urls: [downloadUrl] }
// Generation takes minutes; callers run this inside a Studio job and surface
// progress via onTick. Same OPENROUTER_API_KEY as image generation.
import { writeFileSync } from "node:fs";

const SUBMIT = "https://openrouter.ai/api/v1/videos";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type VideoJobStatus = {
  id?: string;
  status?: string;
  polling_url?: string;
  unsigned_urls?: string[];
  output?: string[];
  url?: string;
  error?: unknown;
};

export interface GenerateClipOptions {
  apiKey: string;
  model: string;
  prompt: string;
  seconds: number;
  aspect?: string;
  resolution?: string;
  generateAudio?: boolean;
  outFile: string;
  pollMs?: number;
  timeoutMs?: number;
  onTick?: (status: VideoJobStatus, elapsedMs: number) => void;
}

function headers(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://cogollosdeloeste.com.ar",
    "X-Title": "codelo-cms",
  };
}

// Generates a clip and downloads it to `outFile`. Returns the path.
export async function generateClip({
  apiKey,
  model,
  prompt,
  seconds,
  aspect = "9:16",
  resolution = "1080p",
  generateAudio = true,
  outFile,
  pollMs = 15_000,
  timeoutMs = 12 * 60 * 1000,
  onTick,
}: GenerateClipOptions): Promise<string> {
  const h = headers(apiKey);

  const res = await fetch(SUBMIT, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      model,
      prompt,
      duration: seconds,
      aspect_ratio: aspect,
      resolution,
      generate_audio: generateAudio,
    }),
  });
  if (!res.ok && res.status !== 202) {
    throw new Error(`OpenRouter video ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  let status = (await res.json()) as VideoJobStatus;
  const pollUrl = status.polling_url || (status.id ? `${SUBMIT}/${status.id}` : null);
  if (!pollUrl) {
    throw new Error(`OpenRouter video: respuesta sin polling_url (${JSON.stringify(status).slice(0, 200)})`);
  }

  const start = Date.now();
  while (status.status !== "completed") {
    if (status.status === "failed" || status.error) {
      throw new Error(`La generación de video falló: ${JSON.stringify(status).slice(0, 300)}`);
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error("Timeout esperando el video (12 min). Probá de nuevo o con un modelo más rápido.");
    }
    await sleep(pollMs);
    const p = await fetch(pollUrl, { headers: h });
    if (!p.ok) throw new Error(`OpenRouter video poll ${p.status}: ${(await p.text()).slice(0, 200)}`);
    status = (await p.json()) as VideoJobStatus;
    onTick?.(status, Date.now() - start);
  }

  const url = status.unsigned_urls?.[0] || status.output?.[0] || status.url;
  if (!url) {
    throw new Error(`Video completado pero sin URL de descarga (${JSON.stringify(status).slice(0, 300)})`);
  }
  const dl = await fetch(url, { headers: h });
  if (!dl.ok) throw new Error(`Descarga del video falló: ${dl.status}`);
  writeFileSync(outFile, Buffer.from(await dl.arrayBuffer()));
  return outFile;
}
