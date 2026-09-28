// Los pools con los que se sortean las portadas —encuadre, tratamiento,
// iluminación, acabado de ilustración— y sus tipos.
//
// Viven aparte de lib/openai.ts, y sin importar nada, para que la costura del
// vertical (verticals/cover-pools.ts) pueda partir de estos sin armar un ciclo:
// openai.ts importa la costura.
//
// Rotan por un seed del artículo: la misma nota regenerada dos veces da las
// mismas restricciones, notas distintas dan combinaciones distintas.

/** Si la portada es una fotografía o algo dibujado/impreso. */
export type TreatmentKind = "photo" | "art";

export interface Treatment {
  kind: TreatmentKind;
  /** El medio, en inglés, tal como se le pide al modelo: "linocut relief print: …". */
  value: string;
}

export type MoodTone = "warm" | "cool" | "harsh" | "night" | "muted" | "vivid";

export interface Mood {
  tone: MoodTone;
  value: string;
}

export interface CoverPools {
  /** Encuadres. Todos de UN solo cuadro: nada partido, ver la nota en openai.ts. */
  compositions: readonly string[];
  /** Tratamientos: la dimensión que evita que todas las portadas se parezcan. */
  treatments: readonly Treatment[];
  /** Iluminación, para los tratamientos fotográficos. */
  moods: readonly Mood[];
  /** Tinta y paleta, para los dibujados. Recibe la paleta de la casa (`brandPalette`). */
  artRenders: (brandPalette: string) => readonly Mood[];
}

// OJO: acá no puede entrar ninguna composición partida. El pool se elige por
// seed, así que una entrada tipo "split two-panel" le tocaba a 1 de cada 8 notas
// y peleaba de frente con la HARD RULE de imagen única y con SINGLE_FRAME_SUFFIX
// (openrouter-image.ts): el modelo obedecía a la composición y devolvía diptychs
// con costura al medio. Toda composición nueva tiene que ser de un solo cuadro.
const COMPOSITIONS: readonly string[] = [
  "macro close-up with shallow depth of field",
  "aerial top-down flat lay",
  "wide environmental shot with leading lines",
  "through-window or doorway framed composition",
  "centred symmetric composition with a single subject",
  "diagonal low-angle perspective",
  "backlit silhouette against a bright ground",
  "close third-person over-the-shoulder view",
];

// ─── Visual treatment (the anti-monotony dimension) ──────────────────────
// Covers used to be uniformly photorealistic because photorealism was asserted
// in three places at once: the system instructions, the user prompt, and a
// STYLES pool whose every entry was a photographic style. The treatment is now
// the thing the seed rotates, and it decides whether the cover is a photograph
// at all. Roughly a third stay photographic — a news portal still needs
// credible photo covers — and the rest are drawn, printed or diagrammatic.
const TREATMENTS: ReadonlyArray<Treatment> = [
  { kind: "photo", value: "documentary photojournalism: natural light, unstaged, reportage framing" },
  { kind: "photo", value: "modern minimalist editorial photography with generous negative space" },
  { kind: "photo", value: "macro nature photography with scientific clarity and fine texture detail" },
  { kind: "photo", value: "archival 1970s film photograph: visible grain, faded dyes, slight vignette" },
  { kind: "art",   value: "19th-century naturalist plate: precise ink linework, hand-tinted watercolour washes, catalogue-sheet layout" },
  { kind: "art",   value: "risograph print: two or three spot inks, visible misregistration, paper tooth showing through" },
  { kind: "art",   value: "linocut relief print: bold carved strokes, stark high contrast, two-colour palette" },
  { kind: "art",   value: "flat vector editorial illustration: geometric shapes, limited palette, poster-like clarity" },
  { kind: "art",   value: "annotated technical diagram: cross-sections, callout leader lines, schematic clarity" },
  { kind: "art",   value: "cut-paper collage: layered textured papers, hard-edged shapes, soft drop shadows" },
  { kind: "art",   value: "ink wash brushwork: gestural strokes, controlled bleed, wide areas of empty paper" },
  { kind: "art",   value: "engraved etching from an old journal: fine cross-hatching, sepia ink on cream stock" },
];

// A photograph's variable axis is light; a drawing's is ink, palette and mark-
// making. Feeding "golden hour with long shadows" to a linocut just produces a
// confused hybrid, so each treatment kind draws from its own pool.
const MOODS: ReadonlyArray<Mood> = [
  { tone: "warm",  value: "golden hour warm light with long shadows" },
  { tone: "cool",  value: "blue hour cold light, melancholy mood" },
  { tone: "harsh", value: "harsh midday sun, high contrast" },
  { tone: "night", value: "single hard light source at night, deep shadows" },
  { tone: "muted", value: "overcast diffused light, desaturated palette" },
  { tone: "warm",  value: "dusk amber light with dramatic clouds" },
  { tone: "cool",  value: "dawn pale blue light, mist in the air" },
  { tone: "vivid", value: "raking side light, saturated colours" },
  { tone: "muted", value: "monochrome / duotone editorial treatment" },
];

/**
 * El pool de acabados de ilustración. Uno de ellos es el duotono de la casa, y
 * por eso se arma con la paleta de los ajustes en vez de traerla escrita: tenía
 * los colores de UN proyecto y se los aplicaba a todos.
 */
const artRenders = (brandPalette: string): ReadonlyArray<Mood> => [
  { tone: "warm",  value: "warm ochre and terracotta inks on cream stock" },
  { tone: "cool",  value: "indigo and slate inks with cold negative space" },
  { tone: "vivid", value: "two saturated spot colours overprinted where they overlap" },
  { tone: "muted", value: "muted earth palette, heavy paper texture, soft edges" },
  { tone: "harsh", value: "stark black ink on bare paper, no midtones" },
  { tone: "warm",  value: `${brandPalette} duotone, matching the house palette` },
  { tone: "cool",  value: "pale washes with a single accent colour" },
  { tone: "muted", value: "sepia monochrome with fine hatching for shading" },
];

/**
 * Los pools del motor. Un vertical puede reemplazar cualquiera desde
 * verticals/cover-pools.ts, o extenderlo: `[...ENGINE_POOLS.moods, …]`.
 */
export const ENGINE_POOLS: CoverPools = {
  compositions: COMPOSITIONS,
  treatments: TREATMENTS,
  moods: MOODS,
  artRenders,
};
