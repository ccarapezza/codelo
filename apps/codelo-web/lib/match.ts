// Fuzzy matching for names read off a physical label.
//
// ⚠️ Twin of apps/codelo-cms/src/lib/inase/parse.ts. The two apps share no
// package (this monorepo has no packages/*), so the logic is duplicated on
// purpose. If you change the folding rules here, change them there too —
// otherwise the CMS stores one normalization and the web searches another.

export function fold(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

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
 * Rank candidates against a name read from a label.
 *
 * Labels are printed sideways on curved foil, so `CRAIG` reads as `CRAI1` about
 * as often as it reads correctly. Exact matching would report "not registered"
 * for a cultivar that is registered — the single worst answer this tool can
 * give, since it is the one a person might act on.
 */
export function bestMatches<T>(
  query: string,
  candidates: T[],
  nameOf: (c: T) => string,
  opts?: { limit?: number; maxDistance?: number },
): Array<{ item: T; distance: number }> {
  const q = fold(query);
  if (q.length === 0) return [];

  const scored = candidates
    .map(item => {
      const name = fold(nameOf(item));
      const distance =
        name === q ? 0 : name.includes(q) || q.includes(name) ? 1 : editDistance(q, name);
      return { item, distance };
    })
    // Tolerance scales with length: one edit on a 4-letter name is a different
    // word; three on a 20-letter one is a smudge.
    .filter(s => s.distance <= (opts?.maxDistance ?? Math.max(2, Math.floor(q.length / 4))));

  scored.sort((a, b) => a.distance - b.distance);
  return scored.slice(0, opts?.limit ?? 5);
}

/**
 * Parse the code carried by the INASE stamp's DataMatrix.
 *
 * Verified against a real packet: the payload is exactly the 14 characters
 * printed beneath it (`01CAA` + 9 digits). No URL, no structured content.
 *
 * ⚠️ It identifies a stamp; it does NOT authenticate one. There is no public
 * endpoint to validate a serial, so nothing built on this may present it as
 * proof of legitimacy.
 */
export function parseSerie(raw: string): { prefijo: string; serie: string; valid: boolean } {
  const s = (raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  const m = /^(\d{2}[A-Z]{2,4})(\d{6,12})$/.exec(s);
  if (!m) return { prefijo: "", serie: "", valid: false };
  return { prefijo: m[1], serie: m[2], valid: true };
}

/** Pull the leading number out of an RNCyFS inscription, e.g. `13481EFK1` → 13481. */
export function numeroDeInscripcion(raw: string): number | null {
  const m = /^\s*(\d+)/.exec(raw ?? "");
  return m ? Number(m[1]) : null;
}
