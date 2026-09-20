// Pure parsing helpers for the INASE mirrors. No I/O, no Strapi — everything
// here is a function of its arguments so it can be unit-tested against the real
// oddities of the source data (see inase/parse.test.ts).

/**
 * Registration categories of the RNCyFS, as published by the official search
 * form's `categoria` dropdown.
 *
 * ⚠️ These are COMPOUND codes, not single letters. `J`/`K` only ever appear
 * followed by a digit. A `numeroInscripcion` like `5667HK2O` is H + K2 + O, NOT
 * H + K + 2 + O — tokenizing character by character silently produces phantom
 * categories.
 */
export const CATEGORIAS = [
  "J1",
  "J2",
  "K1",
  "K2",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "N",
  "O",
  "P",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

// Two-char codes first so the greedy match consumes `K2` before `K`.
const CATEGORIA_ORDER = [...CATEGORIAS].sort((a, b) => b.length - a.length);

export type NumeroInscripcion = {
  /** Full string as published, e.g. `5667HK2O`. */
  raw: string;
  /** Leading numeric part, e.g. 5667. */
  numero: number;
  /** Parsed category codes, e.g. `["H","K2","O"]`. */
  categorias: Categoria[];
  /** True when the suffix parsed cleanly end-to-end. */
  valid: boolean;
};

/**
 * Split a `numeroInscripcion` into its number and its category codes.
 *
 * Returns `valid: false` (with whatever was parsed) rather than throwing: the
 * padrón is someone else's data and a new category code should degrade the row,
 * not abort the whole sync.
 */
export function parseNumeroInscripcion(raw: string): NumeroInscripcion {
  const s = (raw ?? "").trim().toUpperCase();
  const m = /^(\d+)([A-Z0-9]*)$/.exec(s);
  if (!m) return { raw: s, numero: NaN, categorias: [], valid: false };

  const numero = Number(m[1]);
  let rest = m[2];
  const categorias: Categoria[] = [];
  let valid = true;

  while (rest.length > 0) {
    const hit = CATEGORIA_ORDER.find(c => rest.startsWith(c));
    if (!hit) {
      // Unknown code: keep what we have and flag the row.
      valid = false;
      break;
    }
    categorias.push(hit);
    rest = rest.slice(hit.length);
  }

  return { raw: s, numero, categorias, valid };
}

/**
 * Normalize a name for search and matching.
 *
 * Deliberately aggressive because the padrón carries pre-existing encoding
 * damage from INASE's own pipeline: `GÜEMES` ships as `GÑEMES`, and 44 rows
 * already contain a literal `?` where an accent used to be. Users type the
 * clean spelling, so both sides get folded to a lowest common denominator.
 */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ") // punctuation, `?`, and damaged bytes all collapse
    .trim()
    .replace(/\s+/g, " ");
}

/** Levenshtein distance, iterative with a single rolling row. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * Fuzzy-match a cultivar name read off a physical label.
 *
 * Reading labels is unreliable in practice — they are printed sideways on
 * curved foil, and `CRAIG` reads as `CRAI1` or `CRAI;` depending on the light.
 * Exact matching would return nothing for a seed that IS registered, which is
 * the worst possible answer here.
 */
export function bestMatches<T>(
  query: string,
  candidates: T[],
  nameOf: (c: T) => string,
  opts?: { limit?: number; maxDistance?: number },
): Array<{ item: T; distance: number }> {
  const limit = opts?.limit ?? 5;
  const q = normalizeName(query);
  if (q.length === 0) return [];

  const scored = candidates
    .map(item => {
      const name = normalizeName(nameOf(item));
      // Substring hits rank above edit-distance ones: "TROPICANA" should find
      // "TROPICANA WFC" without paying for the four extra characters.
      const distance =
        name === q ? 0 : name.includes(q) || q.includes(name) ? 1 : editDistance(q, name);
      return { item, distance };
    })
    // Tolerance scales with length: 1 edit on a 4-char name is a different word,
    // 3 edits on a 20-char one is a smudge.
    .filter(s => s.distance <= (opts?.maxDistance ?? Math.max(2, Math.floor(q.length / 4))));

  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, limit);
}

export type SerieEstampilla = {
  raw: string;
  /** Leading prefix, `01CAA` on every sample seen so far. */
  prefijo: string;
  /** Zero-padded serial, e.g. `000254089`. */
  serie: string;
  valid: boolean;
};

/**
 * Parse the code carried by the INASE security stamp's DataMatrix.
 *
 * Verified against three real cannabis seed packets: the DataMatrix payload is
 * EXACTLY the string printed beneath it — `01CAA` followed by 9 digits. There is
 * no URL and no structured content.
 *
 * ⚠️ This identifies a stamp; it does NOT authenticate one. INASE exposes no
 * public endpoint to validate a serial (that lives only inside their mobile
 * app), so nothing downstream may present a parsed serial as proof of anything.
 *
 * The prefix is captured rather than required: three samples are not enough to
 * conclude `01CAA` is universal across species or print runs.
 */
export function parseSerieEstampilla(raw: string): SerieEstampilla {
  const s = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(\d{2}[A-Z]{2,4})(\d{6,12})$/.exec(s);
  if (!m) return { raw: s, prefijo: "", serie: "", valid: false };
  return { raw: s, prefijo: m[1], serie: m[2], valid: true };
}
