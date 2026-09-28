// Detección de títulos calcados de un titular fuente. El prompt del redactor
// pide títulos "literales a la fuente" como defensa anti-alucinación, y en
// modo asignado eso degenera en reproducir el titular del medio original —
// inadmisible editorialmente (pasó en producción: un título salió idéntico al
// del medio del que venía la noticia). La regla del prompt sola no alcanza:
// esta compuerta determinística es la garantía.
//
// La comparación es por solapamiento de tokens significativos, no por
// distancia de edición: "Mendoza Reglamenta la Investigación Sanitaria" y
// "Mendoza aprueba reglamentación para la investigación sanitaria" casi no
// comparten prefijos pero son el mismo titular reordenado. Stemming crudo por
// prefijo (6 chars) para que "reglamenta"/"reglamentación" cuenten como el
// mismo token.

const STOPWORDS = new Set([
  // es — solo palabras funcionales; nada temático (p. ej. "paso" NO va acá).
  "como", "cual", "cuales", "cuanto", "cuanta", "cuantos", "cuantas", "donde",
  "cuando", "para", "por", "con", "sin", "del", "los", "las", "una", "uno",
  "unos", "unas", "que", "quien", "este", "esta", "estos", "estas", "ese",
  "esa", "esos", "esas", "sobre", "entre", "desde", "hasta", "segun", "tras",
  "ante", "asi", "mas", "pero", "muy", "son", "esta", "estan", "ser", "hay",
  "fue", "sera", "hacia", "todo", "toda", "todos", "todas",
  // en — los prompts y algunos feeds están en inglés.
  "the", "for", "and", "with", "from", "into", "that", "this", "what", "how",
  "why", "when", "where", "will", "are", "was", "has", "have", "its", "their",
  "about", "after", "before", "over", "under", "not",
]);

/** Tokens significativos, sin acentos, stemmeados por prefijo. */
export function headlineTokens(headline: string): Set<string> {
  const normalized = headline
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  const tokens = new Set<string>();
  for (const raw of normalized.split(/[^a-z0-9ñ]+/)) {
    if (raw.length < 3) continue;
    if (/^\d{1,3}$/.test(raw)) continue; // restos de "6.000" → "6", "000"
    if (STOPWORDS.has(raw)) continue;
    tokens.add(raw.slice(0, 6));
  }
  return tokens;
}

/**
 * true si `candidate` es un calco (o paráfrasis mínima) de `source`.
 * Umbrales calibrados contra los cinco casos reales de la tanda 2026-07-22:
 * los tres calcos dan Jaccard ≥ 0.55 o containment ≥ 0.8; los dos títulos
 * legítimos que comparten tema (misma noticia, otro ángulo) quedan abajo.
 */
export function headlineTooSimilar(candidate: string, source: string): boolean {
  const a = headlineTokens(candidate);
  const b = headlineTokens(source);
  if (a.size === 0 || b.size === 0) return false;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  const jaccard = intersection / union;
  const containment = intersection / Math.min(a.size, b.size);
  return jaccard >= 0.55 || containment >= 0.8;
}

/**
 * Las reglas de originalidad del título, tal como las lee el modelo. Las usan
 * el redactor y el generador manual: el generador no las tenía, y un editor
 * con búsqueda web recibía titulares copiados de la fuente que encontró.
 */
export const TITLE_ORIGINALITY_RULES: readonly string[] = [
  "- The title must be an ORIGINAL headline written in your own words. NEVER copy or closely paraphrase a source's headline: cover the same fact with different wording AND different structure. Reproducing another outlet's headline is plagiarism and grounds for rejection.",
  "- The excerpt must also be written fresh in your own words — never lifted from the source's headline or lede.",
];

/**
 * El pedido de reescritura cuando un título salió calcado: se agrega al user
 * prompt del reintento. El mismo para el redactor y el generador manual.
 */
export function echoFeedback(previousTitle: string, echoed: string): string {
  return `IMPORTANT: your previous title "${previousTitle}" nearly copies the source headline "${echoed}". That is plagiarism. Write a COMPLETELY different headline — same facts, but your own wording and structure (change the opening words, the syntax, the angle). Rewrite the excerpt in your own words too.`;
}

/** Devuelve el titular fuente calcado, o null si el título es original. */
export function findEchoedHeadline(
  candidate: string,
  sourceHeadlines: string[],
): string | null {
  for (const source of sourceHeadlines) {
    if (headlineTooSimilar(candidate, source)) return source;
  }
  return null;
}
