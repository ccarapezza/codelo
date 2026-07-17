// Image generation via OpenRouter (used for Google Gemini "Nano Banana" models).
// We route through OpenRouter instead of Google's API directly because Google Cloud
// billing rejects prepaid cards; OpenRouter passes through the provider price with no
// markup (~$0.039/image for gemini-2.5-flash-image) and accepts prepaid credit / USDC.
// Credentials come from OPENROUTER_API_KEY (env only, never persisted) — see openai-config.ts.

export type OpenRouterImageOptions = { aspectRatio?: string; imageSize?: string };

// Inyectado en TODO prompt de imagen de Gemini: la regla "una sola imagen" en
// las instrucciones del LLM es blanda y queda tapada si el agente tiene un
// template propio; acá viaja directo al modelo de imagen, incondicional, que
// es quien parte la imagen en diptych. (Gemini/"nano-banana" tiende a hacer
// composites lado-a-lado si no se le prohíbe explícitamente.)
const SINGLE_FRAME_SUFFIX =
  " — IMPORTANT: render ONE single unified photograph: one continuous frame, one scene, one background. " +
  "Do NOT split the image, NO diptych, NO side-by-side panels, NO two-up layout, NO collage, grid, montage, " +
  "triptych or before/after, NO internal dividing line, seam or border.";

type OpenRouterChatResponse = {
  choices?: Array<{
    finish_reason?: string;
    message?: { content?: string; images?: Array<{ image_url?: { url?: string } }> };
  }>;
};

type RetryableError = Error & { retryable?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One attempt. Throws with `retryable` set for transient failures (5xx, 429) and
// for the empty-image case — Gemini image models intermittently return a 200 with
// no inline image, which clears on a retry.
async function once(
  apiKey: string,
  model: string,
  prompt: string,
  options?: OpenRouterImageOptions,
): Promise<Buffer> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Attribution headers (surface the app in the OpenRouter dashboard).
      "HTTP-Referer": "https://cogollosdeloeste.example",
      "X-Title": "codelo-cms",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt + SINGLE_FRAME_SUFFIX }],
      modalities: ["image", "text"],
      // Gemini image controls passed through by OpenRouter. Without this the model
      // defaults to a 1:1 1024x1024 square; covers need a landscape aspect ratio.
      image_config: {
        aspect_ratio: options?.aspectRatio ?? "16:9",
        image_size: options?.imageSize ?? "1K",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err: RetryableError = new Error(
      `OpenRouter image request failed: ${res.status} ${body.slice(0, 300)}`,
    );
    err.retryable = res.status >= 500 || res.status === 429;
    throw err;
  }

  const data = (await res.json()) as OpenRouterChatResponse;
  const choice = data.choices?.[0];
  const url = choice?.message?.images?.[0]?.image_url?.url;
  if (!url || !url.startsWith("data:")) {
    // Gemini image models occasionally return a 200 with no inline image
    // (sometimes a text-only response). This is transient — retry. Surface what
    // the model actually returned so a persistent failure is diagnosable.
    const detail = JSON.stringify({
      finish_reason: choice?.finish_reason,
      content: (choice?.message?.content ?? "").slice(0, 200),
    });
    const err: RetryableError = new Error(
      `OpenRouter image response has no inline image data. ${detail}`,
    );
    err.retryable = true;
    throw err;
  }
  const b64 = url.split(",")[1] ?? "";
  return Buffer.from(b64, "base64");
}

// `model` is the full OpenRouter id, e.g. "google/gemini-2.5-flash-image".
// Retries a couple of times for genuinely transient blips. NOTE: some prompts
// make Gemini return an empty 200 *deterministically* (same prompt → empty every
// time); retrying the same text never recovers those. The caller handles that by
// regenerating a fresh prompt (see regenerateCoverFor) — keep this small.
export async function generateOpenRouterImage(
  apiKey: string,
  model: string,
  prompt: string,
  options?: OpenRouterImageOptions,
  retries = 2,
): Promise<Buffer> {
  let last: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await once(apiKey, model, prompt, options);
    } catch (e) {
      last = e;
      if (!(e as RetryableError).retryable || attempt === retries) throw e;
      // Surface retries in the logs so a flaky provider window is visible.
      console.warn(`[openrouter-image] attempt ${attempt}/${retries} failed: ${(e as Error).message}`);
      await sleep(1200 * attempt);
    }
  }
  throw last;
}
