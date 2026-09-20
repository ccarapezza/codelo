// Cost registry for the Social Studio "plan before execute" step.
// Hardcoded estimates (USD) verified jun-2026; providers change pricing, so the
// UI labels everything as "estimado". Single source of truth: serialized to the
// admin via GET /social-studio/config and used server-side for audit metadata.

export interface ImageModelInfo {
  label: string;
  costPerImage: number;
  provider: "openai" | "openrouter";
}

export const IMAGE_MODELS: Record<string, ImageModelInfo> = {
  "gpt-image-1": { label: "GPT Image 1", costPerImage: 0.05, provider: "openai" },
  "gpt-image-1-mini": { label: "GPT Image 1 Mini", costPerImage: 0.012, provider: "openai" },
  "google/gemini-3-pro-image-preview": { label: "Nano Banana Pro (Gemini 3 Pro)", costPerImage: 0.134, provider: "openrouter" },
  "google/gemini-3.1-flash-image-preview": { label: "Nano Banana 2 (Gemini 3.1 Flash)", costPerImage: 0.1, provider: "openrouter" },
  "google/gemini-2.5-flash-image": { label: "Nano Banana (Gemini 2.5 Flash)", costPerImage: 0.039, provider: "openrouter" },
};

export interface VideoModelInfo {
  label: string;
  pricePerSec: number;
  maxSeconds: number;
  resolutions: string[];
  audio: boolean;
  tier: "barato" | "medio" | "hero";
}

export const VIDEO_MODELS: Record<string, VideoModelInfo> = {
  "x-ai/grok-imagine-video": {
    label: "Grok Imagine", pricePerSec: 0.05, maxSeconds: 15,
    resolutions: ["480p", "720p"], audio: false, tier: "barato",
  },
  "google/veo-3.1-lite": {
    label: "Veo 3.1 Lite", pricePerSec: 0.05, maxSeconds: 8,
    resolutions: ["720p", "1080p"], audio: true, tier: "barato",
  },
  "bytedance/seedance-2.0": {
    label: "Seedance 2.0", pricePerSec: 0.067, maxSeconds: 12,
    resolutions: ["720p", "1080p"], audio: false, tier: "barato",
  },
  "minimax/hailuo-2.3": {
    label: "Hailuo 2.3", pricePerSec: 0.0817, maxSeconds: 10,
    resolutions: ["720p", "1080p"], audio: false, tier: "medio",
  },
  "google/veo-3.1-fast": {
    label: "Veo 3.1 Fast", pricePerSec: 0.1, maxSeconds: 8,
    resolutions: ["720p", "1080p"], audio: true, tier: "medio",
  },
  "kwaivgi/kling-v3.0-std": {
    label: "Kling v3.0 Std", pricePerSec: 0.126, maxSeconds: 15,
    resolutions: ["1080p"], audio: true, tier: "medio",
  },
  "google/veo-3.1": {
    label: "Veo 3.1 (hero)", pricePerSec: 0.4, maxSeconds: 8,
    resolutions: ["1080p", "4K"], audio: true, tier: "hero",
  },
};

export const DEFAULT_VIDEO_MODEL = "google/veo-3.1-lite";

// Flat per-chat-call estimate (gpt-4o-mini class) — labeled "estimado" in the UI.
export const LLM_CALL_ESTIMATE_USD = 0.002;

export function pickVideoResolution(model: VideoModelInfo): string {
  return model.resolutions.includes("1080p") ? "1080p" : model.resolutions[0];
}

// ---------------------------------------------------------------------------

export type StudioFormat = "portada" | "carrusel" | "historia" | "reel";

export interface GenerateRequest {
  format: StudioFormat;
  source: { postDocumentId: string } | { customPrompt: string };
  options: {
    imageModel?: string;
    bgFileId?: number;
    slideCount?: number;
    template?: "cover" | "stat" | "quote" | "countdown";
    // Historia: salida estática (imagen) o video (la placa va como overlay
    // transparente sobre un clip de IA).
    output?: "image" | "video";
    // Slide ya compuesto — para recomponer la historia-video sin volver a
    // llamar al LLM (el usuario editó los textos en el preview).
    slide?: unknown;
    videoModel?: string;
    videoSeconds?: number;
    resolution?: string;
    videoPrompt?: string;
    clipFileId?: number;
    overlay?: { type: "title" | "countdown"; fields: Record<string, string> };
  };
}

// ¿Este request produce un video? (reel siempre; historia con output=video)
export function isVideoRequest(req: GenerateRequest): boolean {
  return req.format === "reel" || (req.format === "historia" && req.options.output === "video");
}

export interface CostLine {
  label: string;
  usd: number;
}

export function isPostSource(source: GenerateRequest["source"]): source is { postDocumentId: string } {
  return typeof (source as { postDocumentId?: unknown }).postDocumentId === "string";
}

// Mirrors the real pipeline so the plan is honest:
//   portada+prompt = 0 LLM / 1 img · portada+nota = 3 LLM (anchors+candidatos+juez) / 1 img
//   carrusel/historia = 1 LLM + (fondo existente ? 0 : 1 img)
//   reel = (nota ? 1 LLM : 0) + (clip existente ? 0 : seconds × $/s)
export function estimateCost(req: GenerateRequest): { lines: CostLine[]; totalUsd: number } {
  const lines: CostLine[] = [];
  const fromPost = isPostSource(req.source);
  const imageModel = req.options.imageModel && IMAGE_MODELS[req.options.imageModel]
    ? IMAGE_MODELS[req.options.imageModel]
    : IMAGE_MODELS["google/gemini-2.5-flash-image"];

  const addImage = () => {
    if (req.options.bgFileId) {
      lines.push({ label: "Fondo existente (sin IA)", usd: 0 });
    } else {
      lines.push({ label: `1 imagen IA (${imageModel.label})`, usd: imageModel.costPerImage });
    }
  };

  switch (req.format) {
    case "portada":
      if (fromPost) {
        lines.push({ label: "3 llamadas LLM (prompt de imagen con memoria)", usd: 3 * LLM_CALL_ESTIMATE_USD });
      }
      lines.push({ label: `1 imagen IA (${imageModel.label})`, usd: imageModel.costPerImage });
      break;
    case "carrusel":
      lines.push({ label: "1 llamada LLM (composición del deck + caption)", usd: LLM_CALL_ESTIMATE_USD });
      addImage();
      lines.push({ label: `Render de ${req.options.slideCount ?? "5-7"} placas (satori, sin IA)`, usd: 0 });
      break;
    case "historia":
      if (req.options.output === "video") {
        if (!req.options.slide) {
          lines.push({ label: "1 llamada LLM (composición de la placa)", usd: LLM_CALL_ESTIMATE_USD });
        }
        if (req.options.clipFileId) {
          lines.push({ label: "Clip existente (sin IA)", usd: 0 });
        } else {
          const vm = VIDEO_MODELS[req.options.videoModel ?? DEFAULT_VIDEO_MODEL] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL];
          const seconds = Math.min(req.options.videoSeconds ?? 8, vm.maxSeconds);
          lines.push({ label: `Video IA: ${seconds}s × $${vm.pricePerSec}/s (${vm.label})`, usd: +(seconds * vm.pricePerSec).toFixed(3) });
        }
        lines.push({ label: "Placa overlay + ffmpeg (sin IA)", usd: 0 });
      } else {
        lines.push({ label: "1 llamada LLM (composición de la placa)", usd: LLM_CALL_ESTIMATE_USD });
        addImage();
        lines.push({ label: "Render 1080×1920 (satori, sin IA)", usd: 0 });
      }
      break;
    case "reel": {
      if (fromPost) {
        lines.push({ label: "1 llamada LLM (textos del overlay)", usd: LLM_CALL_ESTIMATE_USD });
      }
      if (req.options.clipFileId) {
        lines.push({ label: "Clip existente (sin IA)", usd: 0 });
      } else {
        const vm = VIDEO_MODELS[req.options.videoModel ?? DEFAULT_VIDEO_MODEL] ?? VIDEO_MODELS[DEFAULT_VIDEO_MODEL];
        const seconds = Math.min(req.options.videoSeconds ?? 8, vm.maxSeconds);
        lines.push({ label: `Video IA: ${seconds}s × $${vm.pricePerSec}/s (${vm.label})`, usd: +(seconds * vm.pricePerSec).toFixed(3) });
      }
      lines.push({ label: "Overlay + composición ffmpeg (sin IA)", usd: 0 });
      break;
    }
  }

  const totalUsd = +lines.reduce((acc, l) => acc + l.usd, 0).toFixed(3);
  return { lines, totalUsd };
}
