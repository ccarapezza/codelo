// Catálogo Nacional de Cultivares (CNC) — mirror of the cannabis/hemp entries.
//
// Feeds the `cultivar` collection so the public search works from our own
// database. INASE going down, or throttling us, must not take the page with it.
//
// ⚠️ IMPORTANT — UNOFFICIAL ENDPOINT
// INASE publishes no API. The public catalogue page is a DataTables grid with
// `serverSide: true`; this module talks to the endpoint that grid calls. It is
// undocumented and unversioned. Every failure path is soft (logs + returns 0)
// so a broken CNC never takes down the cron or the CMS.
//
// Two verified behaviours drive the shape of this code (21/07/2026):
//
//   1. `length` is whitelisted at 100. Ask for 200 and it returns
//      `{iTotalRecords: null, aaData: []}` — HTTP 200, no error. A silent empty
//      page is indistinguishable from "end of data" unless the count is checked,
//      which is why fetchAllRows() validates every page.
//   2. The `searchBuilder` filter does not work over GET (it returns 0 rows even
//      for `MAIZ`). So we page through all ~14.900 rows and filter locally.

import type { Core } from "@strapi/strapi";

const CNC_URL = "https://gestion.inase.gob.ar/registroCultivares/publico/catalogo/servicio";

/** Server-enforced maximum. Larger values fail silently — see header note. */
const PAGE_SIZE = 100;

/**
 * Marks the cannabis/hemp entries. Verified: all 67 carry it, and it is more
 * reliable than filtering on `especie`, which is spelled either `CANNABIS` or
 * `CAÑAMO` depending on the row.
 */
export const CONDICION_CANNABIS = "COMERCIALIZACIÓN: LEY 27350 Y LEY 27669";

/** Row as returned by the endpoint. Only the fields we actually persist. */
export type CncRow = {
  id: number;
  numero_registro: number;
  nombre_definitivo: string | null;
  especie: string | null;
  nombre_cientifico: string | null;
  condicion_genetica: string | null;
  grupo_especie: string | null;
  inscripcion_rnc: string | null;
  inscripcion_rnpc: string | null;
  validez_rnpc: string | null;
  cod_pais: string | null;
  solicitante_rnc: string | null;
  representante_rnc: string | null;
  solicitante_rnpc: string | null;
  representante_rnpc: string | null;
};

type CncPage = {
  iTotalRecords: number | null;
  iTotalDisplayRecords: number | null;
  aaData: CncRow[] | null;
};

async function fetchPage(start: number, timeoutMs: number): Promise<CncPage> {
  const url = `${CNC_URL}?draw=1&start=${start}&length=${PAGE_SIZE}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // The endpoint returns JSON but declares `Content-Type: text/html`, so
    // res.json() is not reliable here — parse the text ourselves.
    return JSON.parse(await res.text()) as CncPage;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Page through the whole catalogue.
 *
 * Throws (rather than returning a partial list) when a page comes back empty
 * before the expected total: a truncated catalogue looks exactly like a
 * successful small one, and the caller would happily mirror it over good data.
 */
export async function fetchAllRows(
  strapi: Core.Strapi,
  opts?: { timeoutMs?: number; delayMs?: number; maxPages?: number },
): Promise<CncRow[]> {
  const timeoutMs = opts?.timeoutMs ?? 30000;
  // Someone else's undocumented endpoint. No rate limiting was observed, but
  // that is not a promise — keep a courteous gap between requests.
  const delayMs = opts?.delayMs ?? 250;
  const maxPages = opts?.maxPages ?? 400;

  const first = await fetchPage(0, timeoutMs);
  const total = first.iTotalRecords;
  if (typeof total !== "number" || !Array.isArray(first.aaData)) {
    throw new Error("respuesta inesperada en la primera página (¿cambió el endpoint?)");
  }

  const rows: CncRow[] = [...first.aaData];
  for (let page = 1; page * PAGE_SIZE < total; page++) {
    if (page >= maxPages) throw new Error(`se superó el tope de ${maxPages} páginas`);
    if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

    const start = page * PAGE_SIZE;
    const data = await fetchPage(start, timeoutMs);
    const batch = data.aaData;
    if (!Array.isArray(batch) || batch.length === 0) {
      // The silent-failure mode described in the header.
      throw new Error(
        `página vacía en start=${start} con ${rows.length}/${total} filas — se aborta para no truncar el espejo`,
      );
    }
    rows.push(...batch);
  }

  if (rows.length < total) {
    throw new Error(`se esperaban ${total} filas y llegaron ${rows.length}`);
  }
  strapi.log.info(`[inase/cultivares] ${rows.length} filas leídas del catálogo.`);
  return rows;
}

/** Keep only the cannabis/hemp entries. */
export function filterCannabis(rows: CncRow[]): CncRow[] {
  return rows.filter(r => r.condicion_genetica === CONDICION_CANNABIS);
}

function toEntry(row: CncRow, syncedAt: Date) {
  return {
    numeroRegistro: row.numero_registro,
    nombre: (row.nombre_definitivo ?? "").trim() || `Registro ${row.numero_registro}`,
    especie: row.especie ?? null,
    nombreCientifico: row.nombre_cientifico ?? null,
    condicionGenetica: row.condicion_genetica ?? null,
    grupoEspecie: row.grupo_especie ?? null,
    inscripcionRnc: row.inscripcion_rnc ?? null,
    inscripcionRnpc: row.inscripcion_rnpc ?? null,
    validezRnpc: row.validez_rnpc ?? null,
    codPais: row.cod_pais ?? null,
    // `solicitante_rnc` is the breeder who registered the genetics. It is NOT
    // the company on the seed packet — that one is the labeller, and lives in
    // the RNCyFS padrón (see inase/operadores.ts).
    solicitanteRnc: row.solicitante_rnc || null,
    representanteRnc: row.representante_rnc || null,
    solicitanteRnpc: row.solicitante_rnpc || null,
    representanteRnpc: row.representante_rnpc || null,
    syncedAt,
  };
}

/**
 * Refresh the `cultivar` mirror. Returns how many rows were created/updated.
 *
 * Upserts by `numeroRegistro` and never deletes: if a run half-fails, the
 * catalogue must degrade to "stale", not to "missing".
 */
export async function syncCultivares(
  strapi: Core.Strapi,
  opts?: { timeoutMs?: number; delayMs?: number },
): Promise<{ created: number; updated: number }> {
  const rows = filterCannabis(await fetchAllRows(strapi, opts));
  if (rows.length === 0) {
    // 67 as of 21/07/2026. Zero means the filter or the payload changed, not
    // that Argentina deregistered every cannabis cultivar overnight.
    throw new Error(
      "el catálogo no trajo ningún cultivar de cannabis — se aborta sin tocar el espejo",
    );
  }

  const syncedAt = new Date();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const data = toEntry(row, syncedAt);
    try {
      const existing = (await strapi.documents("api::cultivar.cultivar").findMany({
        filters: { numeroRegistro: data.numeroRegistro },
        limit: 1,
      })) as unknown as Array<{ documentId: string }>;

      if (existing.length > 0) {
        await strapi
          .documents("api::cultivar.cultivar")
          .update({ documentId: existing[0].documentId, data });
        updated += 1;
      } else {
        await strapi.documents("api::cultivar.cultivar").create({ data });
        created += 1;
      }
    } catch (err) {
      // One bad row must not cost the other 66.
      strapi.log.warn(
        `[inase/cultivares] Registro ${row.numero_registro} falló (se omite): ${(err as Error).message}`,
      );
    }
  }

  strapi.log.info(
    `[inase/cultivares] ${created} nuevos, ${updated} actualizados (${rows.length} de cannabis/cáñamo).`,
  );
  return { created, updated };
}
