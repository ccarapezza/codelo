// Fetchers for the INASE mirrors (cultivares + operadores RNCyFS).
//
// Same conventions as lib/content.ts: server-side fetch against
// NEXT_PUBLIC_CMS_URL, fail-soft (empty list / null) when the CMS is
// unreachable. We read our own mirror, never INASE directly — that is the whole
// point of syncing it: the page keeps working when INASE is down or slow.

export type Cultivar = {
  numeroRegistro: number;
  syncedAt?: string | null;
  nombre: string;
  especie: string | null;
  nombreCientifico: string | null;
  grupoEspecie: string | null;
  inscripcionRnc: string | null;
  inscripcionRnpc: string | null;
  validezRnpc: string | null;
  codPais: string | null;
  /** Breeder who registered the genetics — NOT the company on the packet. */
  solicitanteRnc: string | null;
  representanteRnc: string | null;
  solicitanteRnpc: string | null;
  representanteRnpc: string | null;
};

export type Operador = {
  numeroInscripcion: string;
  numero: number | null;
  categorias: string[];
  razonSocial: string;
  localidad: string | null;
  provincia: string | null;
  cuit: string | null;
  vigente: boolean;
  syncedAt: string | null;
};

type StrapiCollection<T> = {
  data: T[];
  meta?: { pagination?: { page: number; pageSize: number; pageCount: number; total: number } };
};

const getCmsBaseUrl = () => (process.env.NEXT_PUBLIC_CMS_URL ?? "").replace(/\/$/, "");

/**
 * Strapi's `maxLimit` (config/api.ts) caps any pageSize at 100 — and it caps it
 * SILENTLY, returning 100 rows with no indication that more exist. Asking for
 * 500 looks like it works right up until the collection outgrows 100.
 */
const CMS_MAX_PAGE_SIZE = 100;

/**
 * All mirrored cannabis/hemp cultivars.
 *
 * The whole set is fetched and filtered client-side: at 67 rows that is far
 * cheaper than a round trip per keystroke. It pages properly anyway, because
 * cannabis registrations only grow and the cap would truncate without a word.
 */
export async function getCultivares(): Promise<Cultivar[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const fetchPage = async (page: number) => {
    const url = new URL(`${baseUrl}/api/cultivares`);
    url.searchParams.set("pagination[page]", String(page));
    url.searchParams.set("pagination[pageSize]", String(CMS_MAX_PAGE_SIZE));
    url.searchParams.set("sort", "nombre:asc");
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    return (await response.json()) as StrapiCollection<Cultivar>;
  };

  try {
    const first = await fetchPage(1);
    if (!first) return [];

    const rows = [...(first.data ?? [])];
    const pageCount = first.meta?.pagination?.pageCount ?? 1;
    for (let page = 2; page <= pageCount; page++) {
      const next = await fetchPage(page);
      if (!next?.data?.length) break;
      rows.push(...next.data);
    }
    return rows;
  } catch {
    return [];
  }
}

export async function getCultivar(numeroRegistro: number): Promise<Cultivar | null> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(`${baseUrl}/api/cultivares`);
  url.searchParams.set("filters[numeroRegistro][$eq]", String(numeroRegistro));
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const json = (await response.json()) as StrapiCollection<Cultivar>;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Search the RNCyFS padrón.
 *
 * Unlike the cultivars, this one stays server-side: 3.000+ operators is too
 * much to ship to the browser on every visit.
 */
export async function searchOperadores(query: string, limit = 30): Promise<Operador[]> {
  const baseUrl = getCmsBaseUrl();
  const q = query.trim();
  if (!baseUrl || q.length < 2) return [];

  const url = new URL(`${baseUrl}/api/operador-semillas`);

  // Built conditionally, one clause at a time.
  //
  // ⚠️ An empty `$containsi` matches EVERY row. Adding the CUIT clause
  // unconditionally meant `q.replace(/\D/g, "")` was "" for any text query, so
  // searching "RIVARA" returned all 3.032 operators — and the first page of
  // arbitrary names looked plausible enough to miss.
  const clauses: Array<[string, string]> = [];

  // Normalized column, so an accent-free query still finds rows whose names
  // INASE itself shipped damaged.
  const normalized = normalizeQuery(q);
  if (normalized) clauses.push([`[razonSocialNormalizada][$containsi]`, normalized]);
  clauses.push([`[numeroInscripcion][$startsWithi]`, q]);

  // Only when the query actually carries digits, and enough of them to be a
  // CUIT fragment rather than a stray number inside a company name.
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 4) clauses.push([`[cuit][$containsi]`, digits]);

  clauses.forEach(([path, value], i) => url.searchParams.set(`filters[$or][${i}]${path}`, value));
  url.searchParams.set("pagination[pageSize]", String(limit));
  url.searchParams.set("sort", "razonSocial:asc");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const json = (await response.json()) as StrapiCollection<Operador>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

/** Look up one operator by the number printed on a label, e.g. `13481`. */
export async function getOperadorByNumero(numero: number): Promise<Operador | null> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl || !Number.isFinite(numero)) return null;

  const url = new URL(`${baseUrl}/api/operador-semillas`);
  url.searchParams.set("filters[numero][$eq]", String(numero));
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!response.ok) return null;
    const json = (await response.json()) as StrapiCollection<Operador>;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Mirror of the CMS-side normalizeName, for building queries. */
export function normalizeQuery(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Total operators in the mirror. Read from pagination meta — one cheap request. */
export async function getOperadoresTotal(): Promise<number | null> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(`${baseUrl}/api/operador-semillas`);
  url.searchParams.set("pagination[pageSize]", "1");
  url.searchParams.set("filters[vigente][$eq]", "true");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) return null;
    const json = (await response.json()) as StrapiCollection<Operador>;
    return json.meta?.pagination?.total ?? null;
  } catch {
    return null;
  }
}

/** Most recent sync timestamp across the mirrored cultivars. */
export function ultimaSincronizacion(
  cultivares: Array<{ syncedAt?: string | null }>,
): string | null {
  const stamps = cultivares.map(c => c.syncedAt).filter((s): s is string => Boolean(s));
  return stamps.length ? stamps.sort().at(-1)! : null;
}
