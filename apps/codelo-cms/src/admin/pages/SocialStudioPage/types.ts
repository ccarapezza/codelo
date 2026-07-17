// Shared types + client-side cost mirror for the Social Studio page.
// The registries come from GET /api/social-studio/config (server is the
// source of truth); estimateCost here mirrors the server logic so the plan
// updates live while the user tweaks knobs, without a round-trip.

export type StudioFormat = "portada" | "carrusel" | "historia" | "reel";
export type OverlayType = "title" | "countdown";
export type HistoriaTemplate = "cover" | "stat" | "quote" | "countdown";

export interface ImageModelInfo {
  label: string;
  costPerImage: number;
  provider: "openai" | "openrouter";
}

export interface VideoModelInfo {
  label: string;
  pricePerSec: number;
  maxSeconds: number;
  resolutions: string[];
  audio: boolean;
  tier: string;
}

export interface StudioConfig {
  imageModels: Record<string, ImageModelInfo>;
  videoModels: Record<string, VideoModelInfo>;
  llmCallEstimateUsd: number;
  defaults: { imageModel: string; videoModel: string; videoPrompt: string };
  keys: { openai: boolean; openrouter: boolean };
  ffmpegAvailable: boolean;
}

export interface BackgroundFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  size: number;
  createdAt: string;
}

export interface Slide {
  template: string;
  [key: string]: unknown;
}

export interface StudioState {
  sourceMode: "post" | "prompt";
  post: { documentId: string; title: string } | null;
  customPrompt: string;
  format: StudioFormat;
  imageModel: string;
  bgFile: BackgroundFile | null;
  slideCount: number;
  template: HistoriaTemplate;
  historiaOutput: "image" | "video";
  videoModel: string;
  videoSeconds: number;
  videoPrompt: string;
  clipFile: BackgroundFile | null;
  overlayType: OverlayType;
  overlayFields: Record<string, string>;
}

export interface JobStep {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "error";
  detail?: string;
}

export interface DeckResult {
  type: "deck";
  slides: Slide[];
  caption?: string;
  coverPrompt?: string | null;
  bgFileId: number | null;
  size: "portrait" | "story";
  previews: string[];
}

export interface PortadaResult {
  type: "portada";
  fileId: number;
  url: string;
  imagePrompt: string;
}

export interface ReelResult {
  type: "reel";
  clipFileId: number;
  clipUrl: string;
  overlay: { type: OverlayType; fields: Record<string, string> };
  seconds: number;
  videoModel: string;
}

export interface StoryVideoResult {
  type: "story-video";
  slide: Slide;
  clipFileId: number;
  clipUrl: string;
  seconds: number;
  videoModel: string;
}

export interface JobState {
  id: string;
  kind: StudioFormat;
  status: "running" | "completed" | "failed";
  steps: JobStep[];
  result?: PortadaResult | DeckResult | ReelResult | StoryVideoResult;
  error?: string;
  estimatedCostUsd: number;
}

export interface CostLine {
  label: string;
  usd: number;
}

// Mirror of server-side estimateCost (cost-registry.ts) for the live plan card.
export function estimateCost(cfg: StudioConfig, s: StudioState): { lines: CostLine[]; totalUsd: number } {
  const lines: CostLine[] = [];
  const fromPost = s.sourceMode === "post" && s.post !== null;
  const img = cfg.imageModels[s.imageModel] ?? Object.values(cfg.imageModels)[0];

  const addImage = () => {
    if (s.bgFile) lines.push({ label: "Fondo existente (sin IA)", usd: 0 });
    else lines.push({ label: `1 imagen IA (${img.label})`, usd: img.costPerImage });
  };

  switch (s.format) {
    case "portada":
      if (fromPost) lines.push({ label: "3 llamadas LLM (prompt de imagen con memoria)", usd: 3 * cfg.llmCallEstimateUsd });
      lines.push({ label: `1 imagen IA (${img.label})`, usd: img.costPerImage });
      break;
    case "carrusel":
      lines.push({ label: "1 llamada LLM (deck + caption)", usd: cfg.llmCallEstimateUsd });
      addImage();
      lines.push({ label: `Render de ${s.slideCount} placas (satori, sin IA)`, usd: 0 });
      break;
    case "historia":
      if (s.historiaOutput === "video") {
        lines.push({ label: "1 llamada LLM (composición de la placa)", usd: cfg.llmCallEstimateUsd });
        if (s.clipFile) {
          lines.push({ label: "Clip existente (sin IA)", usd: 0 });
        } else {
          const vm = cfg.videoModels[s.videoModel] ?? Object.values(cfg.videoModels)[0];
          const seconds = Math.min(s.videoSeconds, vm.maxSeconds);
          lines.push({ label: `Video IA: ${seconds}s × $${vm.pricePerSec}/s (${vm.label})`, usd: +(seconds * vm.pricePerSec).toFixed(3) });
        }
        lines.push({ label: "Placa overlay + ffmpeg (sin IA)", usd: 0 });
      } else {
        lines.push({ label: "1 llamada LLM (composición de la placa)", usd: cfg.llmCallEstimateUsd });
        addImage();
        lines.push({ label: "Render 1080×1920 (satori, sin IA)", usd: 0 });
      }
      break;
    case "reel": {
      if (fromPost) lines.push({ label: "1 llamada LLM (textos del overlay)", usd: cfg.llmCallEstimateUsd });
      if (s.clipFile) {
        lines.push({ label: "Clip existente (sin IA)", usd: 0 });
      } else {
        const vm = cfg.videoModels[s.videoModel] ?? Object.values(cfg.videoModels)[0];
        const seconds = Math.min(s.videoSeconds, vm.maxSeconds);
        lines.push({ label: `Video IA: ${seconds}s × $${vm.pricePerSec}/s (${vm.label})`, usd: +(seconds * vm.pricePerSec).toFixed(3) });
      }
      lines.push({ label: "Overlay + composición ffmpeg (sin IA)", usd: 0 });
      break;
    }
  }
  const totalUsd = +lines.reduce((a, l) => a + l.usd, 0).toFixed(3);
  return { lines, totalUsd };
}

// Editable fields per template, in display order (mirrors templates.ts).
export const TEMPLATE_FIELDS: Record<string, Array<{ key: string; label: string; multiline?: boolean }>> = {
  hero: [
    { key: "kicker", label: "Kicker" },
    { key: "tagline", label: "Tagline" },
    { key: "hint", label: "Hint" },
  ],
  cover: [
    { key: "kicker", label: "Kicker" },
    { key: "title", label: "Título" },
    { key: "hint", label: "Hint" },
  ],
  stat: [
    { key: "kicker", label: "Kicker" },
    { key: "big", label: "Número grande" },
    { key: "label", label: "Etiqueta" },
  ],
  bullets: [
    { key: "kicker", label: "Kicker" },
    { key: "title", label: "Título" },
  ],
  quote: [
    { key: "text", label: "Frase", multiline: true },
    { key: "by", label: "Autor" },
  ],
  countdown: [
    { key: "pre", label: "Texto previo" },
    { key: "big", label: "Número grande" },
    { key: "unit", label: "Unidad" },
    { key: "label", label: "Etiqueta" },
  ],
  cta: [
    { key: "title", label: "Título" },
    { key: "subtitle", label: "Subtítulo" },
    { key: "url", label: "URL" },
  ],
};

export const OVERLAY_FIELDS: Record<OverlayType, Array<{ key: string; label: string; placeholder?: string }>> = {
  title: [
    { key: "kicker", label: "Kicker", placeholder: "Nueva nota" },
    { key: "title", label: "Título", placeholder: "(de la nota, o escribilo)" },
  ],
  countdown: [
    { key: "pre", label: "Texto previo", placeholder: "Faltan" },
    { key: "big", label: "Número grande", placeholder: "8" },
    { key: "unit", label: "Unidad", placeholder: "días" },
    { key: "label", label: "Etiqueta", placeholder: "para el Mundial 2026" },
  ],
};
