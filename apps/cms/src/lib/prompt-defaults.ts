import { verticalPromptDefaults } from "../verticals/prompt-fields";

// Los campos editoriales del motor y sus valores NEUTROS.
//
// ⚠️ El texto editorial de un proyecto NO va acá ni en ningún otro archivo:
// vive en la base, en el single type `prompt-setting`, y se edita desde el
// panel. Lo de este archivo es sólo el punto de partida de una instancia recién
// levantada — un portal de noticias cualquiera, sin tema. Un proyecto carga los
// suyos una vez con su semilla (src/verticals/seed.ts) y de ahí en más manda la
// base.
//
// Por eso "Restaurar" en el panel devuelve ESTOS valores y no los del proyecto:
// restaurar es volver al motor, no volver a la semilla.
//
// El andamiaje que rodea a estos campos —los esquemas JSON de salida, el
// algoritmo anti-alucinación del Director, el sufijo de seguridad de imagen,
// los STEPS del prompt de portada— es código (openai.ts, agent-runner.ts) y no
// se edita desde el panel: tocarlo rompe el parseo de la respuesta.

// Campos comunes del motor. El vertical puede sumar los suyos
// (src/verticals/prompt-fields.ts); por eso el índice abierto.
export interface PromptSettings {
  [extra: string]: string;

  // ── Identidad ────────────────────────────────────────────────────────────
  /** Marca editorial en cuyo nombre escriben los agentes. */
  brandName: string;
  /** What the site covers — completes "You are a journalist writing … for {this}." */
  domainDescription: string;
  /** Language the articles are written in, e.g. "Spanish". */
  writingLanguage: string;
  /** Usuario de redes que se imprime en las placas y cierra el caption. Vacío = no se imprime. */
  socialHandle: string;

  // ── Línea editorial ──────────────────────────────────────────────────────
  /** Comma list of fact types that must never be invented (interpolated into English prompts). */
  fabricationProneFacts: string;
  /** Framing for the no-verified-news "analysis only" mode (title prefixes, etc.). */
  analysisModeFraming: string;
  /** Markdown formatting/structure rules for the article body (headings, lists, blockquotes, bold). */
  bodyStructureGuide: string;
  /**
   * Fuentes oficiales que SÍ se pueden citar por nombre sin que cuente como
   * reproducir el trabajo de un medio rival. En el idioma de escritura.
   */
  officialSources: string;

  // ── Portadas ─────────────────────────────────────────────────────────────
  /** Domain rules for cover images: what they depict, palettes, forbidden elements. */
  imageSystemInstructions: string;
  /** THEME → SCENE CUES taxonomy the image-prompt generator picks from. */
  imageThemeGuide: string;
  /** Reglas de extracción de anclas. Define además QUÉ claves se extraen. */
  imageAnchorTaxonomy: string;
  /** Dos colores de la casa, en inglés, para el tratamiento duotono. Ej: "amber and deep-blue". */
  brandPalette: string;

  // ── Redes y video ────────────────────────────────────────────────────────
  /** Tipo de organización, voz de marca y reglas duras para las piezas de redes. */
  socialVoice: string;
  /** Cómo tiene que ser la imagen de fondo de la placa de portada. */
  socialCoverStyle: string;
  /** Temas de los hashtags del caption, separados por coma. */
  socialHashtags: string;
  /** Prompt de imagen que se usa cuando el modelo no devuelve uno para la portada. */
  coverFallbackPrompt: string;
  /** Estilo que se le agrega a todo prompt de video. */
  videoStyle: string;
  /** Prompt de video inicial que ofrece Social Studio. */
  videoDefaultPrompt: string;

  // ── Traducción ───────────────────────────────────────────────────────────
  /** Idioma al que se traduce, en inglés. Ej: "English". */
  translationLanguage: string;
  /** Línea completa de qué NO traducir: nombres propios, instituciones, términos del dominio. */
  translationGlossary: string;
}

// Las reglas de formato del cuerpo son las mismas para cualquier tema: lo único
// que cambia son los ejemplos, que acá van neutros.
const BODY_STRUCTURE_GUIDE = [
  "## BODY FORMAT — write rich, well-structured Markdown (never HTML)",
  "- Output GitHub-Flavored Markdown ONLY. Never use HTML tags (<p>, <strong>, <em>, <br>, etc.).",
  "- Open with a strong 2-3 sentence lead paragraph (no heading above it — the title is the H1).",
  "- Break the article into sections with `##` subheadings when it has enough substance (aim for 2-3 in a ~600-word note; a very short note may use just one or none). Subheadings must be specific and informative — never generic like 'Introducción' or 'Conclusión'.",
  "- Use bullet lists (`- `) for enumerations and numbered lists for ordered steps or timelines.",
  "- Format every direct quote or declaration as a Markdown blockquote (`> `), making clear who said it.",
  "- Bold (`**...**`) the key names, dates, figures and concrete facts so the piece is scannable; use italics (`*...*`) sparingly for technical or foreign terms.",
  "- Vary paragraph length and avoid a wall of uniform paragraphs.",
].join("\n");

const IMAGE_SYSTEM_INSTRUCTIONS = [
  "You generate concise, vivid image descriptions for AI image generation.",
  "The images are editorial covers for articles on a general news website.",
  "",
  "- Describe ONE single continuous scene. Never a panel, a grid, a before/after or a collage of separate images.",
  "- The medium (photograph, illustration, print) is assigned to you per cover. Respect it: if it says illustration, do not describe a photograph.",
  "- Prefer objects, places and situations over people. If a person is unavoidable, stage the shot so the face is not readable — from behind, cropped, out of focus, in silhouette — never by mutilating the body.",
  "- Do not name real people, brands or organisations: the model letters names into the image.",
  "- Full bleed. No borders, no frames, no mockups, no text, no watermarks, no logos.",
].join("\n");

// Categorías genéricas: sirven para casi cualquier portal y se reemplazan por
// las del tema desde el panel. Cada una ofrece cuatro escenas para que dos notas
// del mismo tipo no salgan con la misma portada.
const IMAGE_THEME_GUIDE = [
  "THEME → SCENE CUES (pick exactly ONE category, then exactly ONE of its variants)",
  "",
  "INSTITUTIONS / DECISIONS: (a) an empty meeting room after the session; (b) a stack of signed papers on a desk; (c) a corridor of a public building; (d) a lectern with no speaker.",
  "ECONOMY / WORK: (a) hands at a workbench; (b) a loading bay at first light; (c) a counter at opening time; (d) tools laid out in order.",
  "SCIENCE / RESEARCH: (a) instruments on a lab bench; (b) a notebook with measurements; (c) samples in a rack; (d) a screen with a reading, seen at an angle.",
  "COMMUNITY / PEOPLE: (a) chairs in a circle before the meeting; (b) a noticeboard with pinned papers; (c) a shared table after the gathering; (d) an open door to a hall.",
  "HEALTH: (a) a waiting room seen from the entrance; (b) a folder on a consulting-room desk; (c) a corridor with soft light; (d) a window in a treatment room.",
  "ENVIRONMENT: (a) a landscape at dawn; (b) water at the edge of something built; (c) a path between trees; (d) a horizon under weather.",
  "CULTURE: (a) a hall before the audience arrives; (b) an instrument or tool resting; (c) a wall of posters; (d) a workshop at the end of the day.",
  "HISTORY / ANNIVERSARY: (a) an archive drawer half open; (b) an old photograph on a table; (c) a worn façade; (d) a printed page under warm light.",
].join("\n");

const IMAGE_ANCHOR_TAXONOMY = [
  "- topic: the main theme of THIS article, in one or two words.",
  "- palette: the colours the scene should be built from, if the article suggests any.",
  "- eventType: what kind of happening it is — a decision, a launch, a ruling, a gathering.",
  "- venue: the place or setting, only if the article names one.",
].join("\n");

/**
 * Los campos del motor, en orden.
 *
 * Es la fuente de verdad: de acá salen la allowlist del controller y el
 * recorrido del loader. Agregar un campo es un solo cambio, y no tres repartidos
 * que se olvidan de a uno — que es exactamente cómo `brandName` terminó siendo
 * un campo del schema que el panel nunca podía escribir.
 */
export const ENGINE_PROMPT_KEYS = [
  "brandName",
  "domainDescription",
  "writingLanguage",
  "socialHandle",
  "fabricationProneFacts",
  "analysisModeFraming",
  "bodyStructureGuide",
  "officialSources",
  "imageSystemInstructions",
  "imageThemeGuide",
  "imageAnchorTaxonomy",
  "brandPalette",
  "socialVoice",
  "socialCoverStyle",
  "socialHashtags",
  "coverFallbackPrompt",
  "videoStyle",
  "videoDefaultPrompt",
  "translationLanguage",
  "translationGlossary",
] as const;

/** Un portal de noticias cualquiera, sin tema. */
export const NEUTRAL_PROMPT_SETTINGS: PromptSettings = {
  brandName: "Nib",
  domainDescription: "an independent news website",
  writingLanguage: "Spanish",
  socialHandle: "",

  fabricationProneFacts: "dates, figures, official decisions, or quotes",
  analysisModeFraming:
    "clearly framed as opinion or analysis. Never state a recent event as fact.",
  bodyStructureGuide: BODY_STRUCTURE_GUIDE,
  officialSources: "official bodies, laws, court rulings, regulators, peer-reviewed journals",

  imageSystemInstructions: IMAGE_SYSTEM_INSTRUCTIONS,
  imageThemeGuide: IMAGE_THEME_GUIDE,
  imageAnchorTaxonomy: IMAGE_ANCHOR_TAXONOMY,
  brandPalette: "graphite and amber",

  socialVoice:
    "Voz de marca: clara y cercana, sin solemnidad. No publicites productos, marcas ni comercios.",
  socialCoverStyle:
    "que refleje el TEMA de la nota, sin texto, sin logos y sin caras reconocibles",
  socialHashtags: "",
  coverFallbackPrompt: "Editorial image, cinematic, no text, no logos, no faces.",
  videoStyle:
    "Estilo: video editorial y documental, atmosfera cinematografica, luz natural suave, " +
    "camara lenta sutil y movimiento leve y continuo. Formato vertical 9:16. Dejar el centro " +
    "y la mitad inferior mas oscuros y despejados para sobreimprimir texto. MUY IMPORTANTE: " +
    "sin ningun texto, sin letras, sin numeros, sin logos, sin marcas de agua.",
  videoDefaultPrompt:
    "Una superficie con textura a contraluz, movimiento leve, profundidad de campo corta, " +
    "luz dorada de la manana, sin personas ni rostros",

  translationLanguage: "English",
  translationGlossary:
    "- Do NOT translate proper nouns: organisation names, institutions and programmes, law and decree names, place names.",
};

/**
 * Lo neutro del motor más los campos que agrega el vertical, que son CÓDIGO: el
 * prompt de un módulo propio (leer una norma, relatar un partido), no la línea
 * editorial del sitio. Esa vive en la base.
 */
export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  ...NEUTRAL_PROMPT_SETTINGS,
  ...verticalPromptDefaults,
};
