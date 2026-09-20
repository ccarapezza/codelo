import { verticalPromptDefaults } from "../verticals/prompt-fields";
import { promptDefaults } from "../verticals/prompt-defaults";

// Vertical-level prompt customization defaults.
//
// Valores por defecto NEUTROS de los prompts: alcanzan para que el motor
// arranque sin configurar nada, y describen un portal genérico. Los de este
// proyecto viven en src/verticals/prompt-defaults.ts y los pisan. La estructura
// around them (JSON output schemas, the director's anti-hallucination
// algorithm, the image safety suffix, the prompt-building STEPS) lives in code
// (openai.ts / agent-runner.ts) and interpolates these fields via placeholders.
//
// The `prompt-setting` single type lets an admin override any of these from the
// UI. getPromptSettings() falls back to these defaults field-by-field. To
// retarget the whole project to another vertical only these fields change — no
// code edits.

// Campos comunes del motor. El vertical puede sumar los suyos
// (src/verticals/prompt-fields.ts); por eso el índice abierto.
export interface PromptSettings {
  [extra: string]: string;
  /** Marca editorial en cuyo nombre escriben los agentes. */
  brandName: string;
  /** What the site covers — completes "You are a journalist writing … for {this}." */
  domainDescription: string;
  /** Language the articles are written in, e.g. "Spanish". */
  writingLanguage: string;
  /** Comma list of fact types that must never be invented (interpolated into English prompts). */
  fabricationProneFacts: string;
  /** Framing for the no-verified-news "analysis only" mode (title prefixes, etc.). */
  analysisModeFraming: string;
  /** Markdown formatting/structure rules for the article body (headings, lists, blockquotes, bold). */
  bodyStructureGuide: string;
  /** Domain rules for cover images: what they depict, palettes, forbidden elements. */
  imageSystemInstructions: string;
  /** THEME → SCENE CUES taxonomy the image-prompt generator picks from. */
  imageThemeGuide: string;
  /** Per-field extraction rules for the visual anchors. */
  imageAnchorTaxonomy: string;
  /** Triage scale + extraction rules for the Boletín Oficial norm analysis. */
}

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  // Neutros: un portal de noticias cualquiera. El vertical los reemplaza.
  brandName: "Nib",
  domainDescription: "an independent news website",
  writingLanguage: "Spanish",
  fabricationProneFacts: "dates, figures, official decisions, or quotes",
  analysisModeFraming:
    "clearly framed as opinion or analysis. Never state a recent event as fact.",
  bodyStructureGuide: "",
  imageSystemInstructions: "",
  imageThemeGuide: "",
  imageAnchorTaxonomy: "",
  // Lo del proyecto pisa a lo neutro.
  ...verticalPromptDefaults,
  ...promptDefaults,
};
