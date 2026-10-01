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
  defaults: { imageModel: string; videoModel: string };
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
  /** Clave de traducción; se traduce al renderizar, con `params`. */
  label: string;
  params?: Record<string, string | number>;
  usd: number;
}

// Mirror of server-side estimateCost (cost-registry.ts) for the live plan card.
export function estimateCost(cfg: StudioConfig, s: StudioState): { lines: CostLine[]; totalUsd: number } {
  const lines: CostLine[] = [];
  const fromPost = s.sourceMode === "post" && s.post !== null;
  const img = cfg.imageModels[s.imageModel] ?? Object.values(cfg.imageModels)[0];

  const addImage = () => {
    if (s.bgFile) lines.push({ label: "ss.costo.fondoExistente", usd: 0 });
    else lines.push({ label: "ss.costo.imagen", params: { modelo: img.label }, usd: img.costPerImage });
  };

  switch (s.format) {
    case "portada":
      if (fromPost) lines.push({ label: "ss.costo.llmPortada", usd: 3 * cfg.llmCallEstimateUsd });
      lines.push({ label: "ss.costo.imagen", params: { modelo: img.label }, usd: img.costPerImage });
      break;
    case "carrusel":
      lines.push({ label: "ss.costo.llmDeck", usd: cfg.llmCallEstimateUsd });
      addImage();
      lines.push({ label: "ss.costo.render", params: { n: s.slideCount }, usd: 0 });
      break;
    case "historia":
      if (s.historiaOutput === "video") {
        lines.push({ label: "ss.costo.llmPlaca", usd: cfg.llmCallEstimateUsd });
        if (s.clipFile) {
          lines.push({ label: "ss.costo.clipExistente", usd: 0 });
        } else {
          const vm = cfg.videoModels[s.videoModel] ?? Object.values(cfg.videoModels)[0];
          const seconds = Math.min(s.videoSeconds, vm.maxSeconds);
          lines.push({
          label: "ss.costo.video",
          params: { s: seconds, precio: vm.pricePerSec, modelo: vm.label },
          usd: +(seconds * vm.pricePerSec).toFixed(3),
        });
        }
        lines.push({ label: "ss.costo.placaOverlay", usd: 0 });
      } else {
        lines.push({ label: "ss.costo.llmPlaca", usd: cfg.llmCallEstimateUsd });
        addImage();
        lines.push({ label: "ss.costo.render1080", usd: 0 });
      }
      break;
    case "reel": {
      // Igual que el servidor: la llamada también describe el clip cuando no
      // hay prompt escrito ni clip elegido.
      const describeClip = !s.clipFile && !s.videoPrompt.trim();
      if (fromPost || describeClip) lines.push({ label: "ss.costo.llmOverlay", usd: cfg.llmCallEstimateUsd });
      if (s.clipFile) {
        lines.push({ label: "ss.costo.clipExistente", usd: 0 });
      } else {
        const vm = cfg.videoModels[s.videoModel] ?? Object.values(cfg.videoModels)[0];
        const seconds = Math.min(s.videoSeconds, vm.maxSeconds);
        lines.push({
          label: "ss.costo.video",
          params: { s: seconds, precio: vm.pricePerSec, modelo: vm.label },
          usd: +(seconds * vm.pricePerSec).toFixed(3),
        });
      }
      lines.push({ label: "ss.costo.composicion", usd: 0 });
      break;
    }
  }
  const totalUsd = +lines.reduce((a, l) => a + l.usd, 0).toFixed(3);
  return { lines, totalUsd };
}

// Las etiquetas y los placeholders son CLAVES: se traducen al renderizar.
// Editable fields per template, in display order (mirrors templates.ts).
export const TEMPLATE_FIELDS: Record<string, Array<{ key: string; label: string; multiline?: boolean }>> = {
  hero: [
    { key: "kicker", label: "ss.campo.kicker" },
    { key: "tagline", label: "ss.campo.tagline" },
    { key: "hint", label: "ss.campo.hint" },
  ],
  cover: [
    { key: "kicker", label: "ss.campo.kicker" },
    { key: "title", label: "ss.campo.titulo" },
    { key: "hint", label: "ss.campo.hint" },
  ],
  stat: [
    { key: "kicker", label: "ss.campo.kicker" },
    { key: "big", label: "ss.campo.numero" },
    { key: "label", label: "ss.campo.etiqueta" },
  ],
  bullets: [
    { key: "kicker", label: "ss.campo.kicker" },
    { key: "title", label: "ss.campo.titulo" },
  ],
  quote: [
    { key: "text", label: "ss.campo.frase", multiline: true },
    { key: "by", label: "ss.campo.autor" },
  ],
  countdown: [
    { key: "pre", label: "ss.campo.previo" },
    { key: "big", label: "ss.campo.numero" },
    { key: "unit", label: "ss.campo.unidad" },
    { key: "label", label: "ss.campo.etiqueta" },
  ],
  cta: [
    { key: "title", label: "ss.campo.titulo" },
    { key: "subtitle", label: "ss.campo.subtitulo" },
    { key: "url", label: "URL" },
  ],
};

export const OVERLAY_FIELDS: Record<OverlayType, Array<{ key: string; label: string; placeholder?: string }>> = {
  title: [
    { key: "kicker", label: "ss.campo.kicker", placeholder: "ss.ph.nuevaNota" },
    { key: "title", label: "ss.campo.titulo", placeholder: "ss.ph.deLaNota" },
  ],
  countdown: [
    { key: "pre", label: "ss.campo.previo", placeholder: "ss.ph.faltan" },
    { key: "big", label: "ss.campo.numero", placeholder: "8" },
    { key: "unit", label: "ss.campo.unidad", placeholder: "ss.ph.dias" },
    { key: "label", label: "ss.campo.etiqueta", placeholder: "ss.ph.evento" },
  ],
};
