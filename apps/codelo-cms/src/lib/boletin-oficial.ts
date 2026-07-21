// Boletín Oficial de la República Argentina — normative watch.
//
// Feeds `news-context` with newly published norms matching the association's
// statutory topics (REPROCANN, cannabis/cáñamo industry, drug policy), so the
// Redactor can write about regulatory changes with the norm itself as source
// instead of second-hand press coverage.
//
// ⚠️ IMPORTANT — UNOFFICIAL ENDPOINT
// boletinoficial.gob.ar publishes NO RSS and NO documented public API. This
// module talks to `/busquedaAvanzada/realizarBusqueda`, the internal endpoint
// its own search UI calls. It is undocumented and unversioned: it can change
// without notice and break this module. Every failure path here is soft (logs
// + returns empty) so a broken BO never takes down the agent run or the CMS.
// The RSS feeds remain the primary source; this is complementary.

import type { Core } from "@strapi/strapi";
import type { NewsItem } from "./rss-fetcher";

const BO_BASE = "https://www.boletinoficial.gob.ar";
const BO_SEARCH = `${BO_BASE}/busquedaAvanzada/realizarBusqueda`;

// Browser-ish headers: the endpoint is meant for its own UI and rejects
// requests that don't look like the search page's XHR.
const BO_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "X-Requested-With": "XMLHttpRequest",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  Referer: `${BO_BASE}/busquedaAvanzada/primera`,
  Accept: "application/json, text/javascript, */*; q=0.01",
};

/** Primera Sección — "Legislación y Avisos Oficiales" (leyes, decretos, resoluciones). */
const SECCION_LEGISLACION = 1;

/**
 * Search terms covering the statutory topics. Kept deliberately broad — the
 * date filter, not the query, is what keeps the volume manageable.
 */
export const DEFAULT_BO_TERMS = [
  "cannabis",
  "cáñamo",
  "REPROCANN",
  "estupefacientes",
  "reducción de daños",
];

export type BoletinItem = NewsItem & {
  /** Rubro heading the item sits under, e.g. "LEYES", "RESOLUCIONES". */
  rubro: string | null;
  /** Norm identifier when present, e.g. "Ley 27669", "Resolución 123/2025". */
  norma: string | null;
};

// ---------------------------------------------------------------------------
// HTML helpers — the endpoint returns a server-rendered fragment inside JSON,
// so there is no structured payload to read; we parse the markup.
// ---------------------------------------------------------------------------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ");
}

/** Strip tags (including the <span> hit highlighting) and collapse whitespace. */
function stripTags(html: string): string {
  return decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Fecha de Publicacion: 26/05/2022" → Date. Null if unparsable.
 *
 * Anchored at 12:00 UTC, not midnight: the Boletín gives a calendar date with
 * no time, and midnight UTC renders as the PREVIOUS day in Argentina (UTC-3),
 * which would date every norm one day early. Noon keeps the calendar day
 * intact across every real-world offset.
 */
function parseFechaPublicacion(text: string): Date | null {
  const m = text.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd), 12));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse the results fragment into items.
 *
 * Markup shape (verified against the live endpoint):
 *   <h5 class="seccion-rubro ...">LEYES</h5>          ← applies to items below
 *   <a href="/detalleAviso/primera/{id}/{yyyymmdd}">
 *     <p class="item">TITLE</p>
 *     <p class="item-detalle"><small>Ley 27669</small></p>
 *     <p class="item-detalle"><small>Fecha de Publicacion: 26/05/2022</small></p>
 *     <p class="item-detalle"><small>SUMMARY…</small></p>
 *   </a>
 */
export function parseBoletinHtml(html: string): BoletinItem[] {
  const items: BoletinItem[] = [];

  // Walk rubro headings and anchors in document order so each item inherits
  // the rubro that precedes it.
  const token = /<h5[^>]*class="[^"]*seccion-rubro[^"]*"[^>]*>([\s\S]*?)<\/h5>|<a\s+href="(\/detalleAviso\/[^"]+)"[\s\S]*?<\/a>/gi;
  let rubro: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = token.exec(html)) !== null) {
    if (m[1] !== undefined) {
      rubro = stripTags(m[1]) || null;
      continue;
    }
    const href = m[2];
    const block = m[0];

    const titleMatch = block.match(/<p class="item"[^>]*>([\s\S]*?)<\/p>/i);
    const title = titleMatch ? stripTags(titleMatch[1]) : "";
    if (!title) continue;

    const details = [...block.matchAll(/<p class="item-detalle"[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((d) => stripTags(d[1]))
      .filter(Boolean);

    const fechaText = details.find((d) => /Fecha de Publicacion/i.test(d)) ?? "";
    const itemPublishedAt = parseFechaPublicacion(fechaText);
    const rest = details.filter((d) => d !== fechaText);
    // First non-date detail is the norm id; the longest remaining one is the body.
    const norma = rest.length > 1 ? rest[0] : null;
    const summary = rest.length > 0 ? rest[rest.length - 1] : "";

    items.push({
      title,
      url: `${BO_BASE}${href.split("?")[0]}`, // drop ?busqueda=1 so the URL is a stable dedup key
      source: "Boletín Oficial",
      summary,
      itemPublishedAt,
      rubro,
      norma,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/** Lowercase + strip accents, so "cáñamo" and "canamo" compare equal. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * Whether an item genuinely matches the term.
 *
 * The endpoint treats a multi-word query as OR, so "reducción de daños" comes
 * back with every decree containing "de" — ~100 hits about energy tariffs and
 * administrative procedure. Requiring EVERY significant word of the term to be
 * present in the item drops that noise without needing a hand-kept blocklist.
 */
function itemMatchesTerm(item: BoletinItem, term: string): boolean {
  const haystack = normalize(`${item.title} ${item.norma ?? ""} ${item.summary}`);
  const words = normalize(term)
    .split(/\s+/)
    .filter((w) => w.length > 3); // skip stop-words like "de", "y", "la"
  if (words.length === 0) return true;
  return words.every((w) => haystack.includes(w));
}

/** The endpoint's date fields expect DD/MM/YYYY. */
function formatBoDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

async function searchTerm(
  texto: string,
  desde: Date,
  hasta: Date,
  timeoutMs: number,
): Promise<BoletinItem[]> {
  // Bounding the range SERVER-side is what makes this a watch instead of an
  // archive dump: results come grouped by rubro (LEYES, DECRETOS, …) and NOT
  // sorted by date, spread over several pages. Unbounded, "cannabis" returns
  // ~290 hits from 1999 onward and a norm published yesterday can sit on page
  // 3. With a date range the set is small enough to fit in page 1.
  const params = {
    texto,
    seccion: [SECCION_LEGISLACION],
    fechaDesde: formatBoDate(desde),
    fechaHasta: formatBoDate(hasta),
    numeroPagina: 1,
    tipoBusqueda: "Avanzada",
    busquedaRubro: false,
  };
  const body = new URLSearchParams({
    params: JSON.stringify(params),
    array_volver: "[]",
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BO_SEARCH, {
      method: "POST",
      headers: BO_HEADERS,
      body,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = (await res.json()) as {
      error?: number;
      content?: { html?: string } | null;
      mensajes?: string[];
    };
    // The endpoint answers 200 with an in-band error code.
    if (json.error !== 0) {
      throw new Error(json.mensajes?.join("; ") || `error=${json.error}`);
    }
    // A term with no hits answers error=0 with an EMPTY html string — that is a
    // valid "nothing found", not a failure. (REPROCANN, for one, never appears
    // verbatim in the Boletín.)
    const html = json.content?.html ?? "";
    if (!html) return [];
    return parseBoletinHtml(html);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Baja el texto completo de una norma desde su página de detalle.
 *
 * El buscador solo devuelve un snippet de ~180 caracteres, truncado por el
 * propio Boletín ("…Solicitante:..."). Con eso el Redactor tiene el hecho pero
 * no el detalle, y rellena con generalidades. La página de detalle es HTML
 * plano (no SPA) y trae el texto íntegro en `#cuerpoDetalleAviso`: para el
 * aviso del INASE son 3.344 caracteres contra 172, e incluye el decreto que
 * funda el trámite, los responsables y la fundamentación técnica.
 *
 * Falla suave: si no se puede bajar o parsear, el llamador conserva el snippet.
 */
async function fetchAvisoDetail(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: BO_HEADERS, signal: controller.signal });
    if (!res.ok) return null;
    const html = await res.text();

    const marker = html.indexOf('id="cuerpoDetalleAviso"');
    if (marker === -1) return null;

    // Arrancar DESPUÉS del cierre del tag de apertura: si se corta en la
    // posición del id, el texto se lleva los atributos que siguen
    // (class="col-md-12 …") y aparecen como si fueran parte de la norma.
    const openEnd = html.indexOf(">", marker);
    if (openEnd === -1) return null;

    // Sin parser de DOM: se toma un bloque generoso desde el contenedor y se
    // limpia. El contenedor trae <style> inline con reglas de tablas, que sin
    // quitar se cuelan como "table tr td {border: 1px solid grey…}".
    const chunk = html
      .slice(openEnd + 1, openEnd + 24000)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const text = stripTags(chunk);
    return text.length > 40 ? text.slice(0, 2000) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search each term over the last `sinceDays` and return the matching norms.
 *
 * The range is applied server-side (see searchTerm) and re-checked here:
 * items with an unparsable date are dropped rather than assumed recent.
 */
export async function fetchRecentBoletinItems(
  strapi: Core.Strapi,
  opts?: { terms?: string[]; sinceDays?: number; timeoutMs?: number; delayMs?: number },
): Promise<BoletinItem[]> {
  const terms = opts?.terms ?? DEFAULT_BO_TERMS;
  const sinceDays = opts?.sinceDays ?? 7;
  const timeoutMs = opts?.timeoutMs ?? 20000;
  const delayMs = opts?.delayMs ?? 1200;

  const hasta = new Date();
  const cutoff = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const byUrl = new Map<string, BoletinItem>();

  // Sequential with a pause between terms: this is someone else's public site
  // and an undocumented endpoint — no reason to hammer it.
  for (const term of terms) {
    try {
      const found = await searchTerm(term, cutoff, hasta, timeoutMs);
      const recent = found.filter(
        (i) =>
          i.itemPublishedAt !== null &&
          i.itemPublishedAt >= cutoff &&
          itemMatchesTerm(i, term),
      );
      for (const item of recent) byUrl.set(item.url, item);
      strapi.log.info(
        `[boletin-oficial] "${term}": ${found.length} resultados, ${recent.length} relevantes en los últimos ${sinceDays} días.`,
      );
    } catch (err) {
      // Soft failure: a changed endpoint must not break the agent run.
      strapi.log.warn(
        `[boletin-oficial] Búsqueda "${term}" falló (se omite): ${(err as Error).message}`,
      );
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  const items = [...byUrl.values()];

  // Segundo paso: por cada norma nueva se baja su texto completo. Son pocas
  // (unas 4 por día), secuenciales y con pausa: el volumen no justifica
  // paralelizar contra un sitio ajeno.
  let enriched = 0;
  for (const item of items) {
    const full = await fetchAvisoDetail(item.url, timeoutMs);
    if (full && full.length > item.summary.length) {
      item.summary = full;
      enriched += 1;
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  strapi.log.info(
    `[boletin-oficial] Texto completo obtenido para ${enriched}/${items.length} normas.`,
  );

  return items;
}

/**
 * Fetch recent norms and store the new ones in `news-context`, mirroring what
 * rss-fetcher does. Dedup is by `url`, which is unique on the content type.
 * Returns how many rows were created.
 */
export async function fetchBoletinOficialIntoContext(
  strapi: Core.Strapi,
  opts?: { terms?: string[]; sinceDays?: number },
): Promise<number> {
  const items = await fetchRecentBoletinItems(strapi, opts);
  if (items.length === 0) {
    strapi.log.info("[boletin-oficial] Sin normas nuevas en el período.");
    return 0;
  }

  const urls = items.map((i) => i.url);
  const existing = (await strapi
    .documents("api::news-context.news-context")
    .findMany({ filters: { url: { $in: urls } } })) as unknown as Array<{ url: string }>;
  const existingUrls = new Set(existing.map((e) => e.url));
  const toCreate = items.filter((i) => !existingUrls.has(i.url));

  strapi.log.info(
    `[boletin-oficial] ${toCreate.length} normas nuevas (${existingUrls.size} ya estaban).`,
  );

  const fetchedAt = new Date();
  let created = 0;
  for (const item of toCreate) {
    // Prefix the norm id so the Redactor sees "Ley 27669 — TITLE" in context.
    const title = item.norma ? `${item.norma} — ${item.title}` : item.title;
    try {
      await strapi.documents("api::news-context.news-context").create({
        data: {
          title: title.slice(0, 255),
          url: item.url,
          source: item.rubro ? `Boletín Oficial · ${item.rubro}` : "Boletín Oficial",
          summary: item.summary.slice(0, 2000),
          itemPublishedAt: item.itemPublishedAt ?? fetchedAt,
          fetchedAt,
        },
      });
      created += 1;
    } catch {
      strapi.log.debug(`[boletin-oficial] Duplicado, se omite: ${item.url}`);
    }
  }
  return created;
}
