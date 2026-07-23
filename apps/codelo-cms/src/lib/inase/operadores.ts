// RNCyFS — Registro Nacional de Comercio y Fiscalización de Semillas.
//
// Mirrors the padrón of registered seed operators so the public search can
// answer the one question nobody has a comfortable channel for: "does this
// registration number appear in the official padrón, and for what activities?".
//
// Note the framing, here and in the UI copy: the tool verifies a REGISTRATION,
// never "who sells you". The association is not a buying guide (Art. 2°), and
// wording that implies otherwise turns a public-interest lookup into a
// shopping aid.
//
// The source is a single undocumented CSV export behind the official (paginated,
// 20-rows-at-a-time) search UI. One request, ~300 KB, under a second.
//
// ⚠️ The file is a mess, and every step of parseTsv() exists because of it.
// All of the following was verified against the live export on 21/07/2026:
//
//   - It opens with a UTF-8 BOM but the body is ISO-8859-1, so the file is not
//     valid UTF-8. Decoding it as UTF-8 (i.e. `res.text()`) turns every accented
//     name into U+FFFD.
//   - INASE's own pipeline already damaged some rows: `GÜEMES` arrives as the
//     byte for `Ñ`, and 44 rows carry a literal `?` where an accent used to be.
//     That is unrecoverable — normalizeName() folds it so search still works.
//   - Fields are wrapped in double quotes, which a naive tab-split leaves glued
//     to the value.
//   - There is NO `telefono` column, despite what one might expect.

import type { Core } from "@strapi/strapi";
import { normalizeName, parseNumeroInscripcion } from "./parse";

const RNCYFS_EXPORT = "https://gestion.inase.gob.ar/empresas/empresas/export";

/**
 * Sanity floor for the row count. The padrón held 3.030 operators on
 * 21/07/2026; a sudden collapse means a broken export, not 3.000 closures.
 */
const MIN_EXPECTED_ROWS = 2000;

export type OperadorRow = {
  numeroInscripcion: string;
  razonSocial: string;
  localidad: string | null;
  provincia: string | null;
  cuit: string | null;
};

/** Strip wrapping quotes and surrounding whitespace from one TSV field. */
function unquote(field: string): string {
  const s = (field ?? "").trim();
  return s.length >= 2 && s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).trim() : s;
}

/**
 * Parse the export into rows.
 *
 * Exported for tests — this is the part most likely to break when INASE changes
 * something, and the part hardest to eyeball.
 */
export function parseTsv(text: string): OperadorRow[] {
  // Drop the BOM, otherwise the first header key is not "numeroInscripcion" and
  // every row silently loses its registration number.
  //
  // ⚠️ Two forms, because the file's BOM and its body disagree about encoding.
  // The bytes are EF BB BF (a UTF-8 BOM), but we decode the body as latin1 —
  // so they arrive as the three characters `ï»¿`, NOT as U+FEFF. Stripping only
  // U+FEFF looks right and fails against the real export.
  const clean = text.replace(/^(﻿|ï»¿)/, "");
  const lines = clean.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t").map(h => unquote(h));
  const idx = (name: string) => headers.indexOf(name);
  const iNum = idx("numeroInscripcion");
  const iRaz = idx("razonSocial");
  const iLoc = idx("localidad");
  const iProv = idx("provincia");
  const iCuit = idx("cuit");

  if (iNum < 0 || iRaz < 0) {
    throw new Error(`el export no trae las columnas esperadas: ${headers.join(", ")}`);
  }

  const rows: OperadorRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split("\t");
    const numeroInscripcion = unquote(cols[iNum] ?? "");
    const razonSocial = unquote(cols[iRaz] ?? "");
    if (!numeroInscripcion || !razonSocial) continue;
    rows.push({
      numeroInscripcion,
      razonSocial,
      localidad: unquote(cols[iLoc] ?? "") || null,
      provincia: unquote(cols[iProv] ?? "") || null,
      cuit: unquote(cols[iCuit] ?? "") || null,
      // NOTE: the export also carries an `email` column with ~3.000 addresses in
      // the clear. It is deliberately NOT read here — see syncOperadores().
    });
  }
  return rows;
}

/** Download and decode the padrón. */
export async function fetchOperadores(
  strapi: Core.Strapi,
  opts?: { timeoutMs?: number },
): Promise<OperadorRow[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 30000);
  try {
    const res = await fetch(RNCYFS_EXPORT, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Bytes, not text: the body is latin1 and `res.text()` would mangle it.
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buf);
    const rows = parseTsv(text);
    strapi.log.info(`[inase/operadores] ${rows.length} operadores leídos del padrón.`);
    return rows;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Refresh the `operador-semilla` mirror.
 *
 * Operators that vanish from the export are marked `vigente: false` rather than
 * deleted, so a stale link keeps resolving to an honest "no longer listed"
 * instead of a 404.
 */
export async function syncOperadores(
  strapi: Core.Strapi,
  opts?: { timeoutMs?: number },
): Promise<{ created: number; updated: number; retired: number }> {
  const rows = await fetchOperadores(strapi, opts);
  if (rows.length < MIN_EXPECTED_ROWS) {
    throw new Error(
      `el padrón trajo solo ${rows.length} filas (se esperaban >${MIN_EXPECTED_ROWS}) — se aborta sin tocar el espejo`,
    );
  }

  const syncedAt = new Date();
  const seen = new Set<string>();
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const parsed = parseNumeroInscripcion(row.numeroInscripcion);
    if (!parsed.valid) {
      strapi.log.debug(
        `[inase/operadores] Nº ${row.numeroInscripcion} no parseó limpio; se guarda igual.`,
      );
    }
    seen.add(row.numeroInscripcion);

    const data = {
      numeroInscripcion: row.numeroInscripcion,
      numero: Number.isFinite(parsed.numero) ? parsed.numero : null,
      categorias: parsed.categorias,
      razonSocial: row.razonSocial,
      // Precomputed so search does not have to fold 3.000 names per keystroke.
      razonSocialNormalizada: normalizeName(row.razonSocial),
      localidad: row.localidad,
      provincia: row.provincia,
      cuit: row.cuit,
      vigente: true,
      syncedAt,
    };

    try {
      const existing = (await strapi.documents("api::operador-semilla.operador-semilla").findMany({
        filters: { numeroInscripcion: row.numeroInscripcion },
        limit: 1,
      })) as unknown as Array<{
        documentId: string;
      }>;

      if (existing.length > 0) {
        await strapi
          .documents("api::operador-semilla.operador-semilla")
          .update({ documentId: existing[0].documentId, data });
        updated += 1;
      } else {
        await strapi.documents("api::operador-semilla.operador-semilla").create({ data });
        created += 1;
      }
    } catch (err) {
      strapi.log.warn(
        `[inase/operadores] Nº ${row.numeroInscripcion} falló (se omite): ${(err as Error).message}`,
      );
    }
  }

  // Retire whatever is no longer listed.
  let retired = 0;
  const stored = (await strapi
    .documents("api::operador-semilla.operador-semilla")
    .findMany({ filters: { vigente: true }, limit: -1 })) as unknown as Array<{
    documentId: string;
    numeroInscripcion: string;
  }>;
  for (const doc of stored) {
    if (seen.has(doc.numeroInscripcion)) continue;
    try {
      await strapi
        .documents("api::operador-semilla.operador-semilla")
        .update({ documentId: doc.documentId, data: { vigente: false, syncedAt } });
      retired += 1;
    } catch {
      /* soft: a row we could not retire is stale, not wrong */
    }
  }

  strapi.log.info(
    `[inase/operadores] ${created} nuevos, ${updated} actualizados, ${retired} dados de baja.`,
  );
  return { created, updated, retired };
}
