// Boletín Oficial de la República Argentina — normative watch.
//
// Busca las normas nuevas que tocan los objetos estatutarios de la asociación
// (REPROCANN, cannabis/cáñamo, políticas de drogas), las archiva con su texto
// íntegro en `norma` y las manda a leer por IA (ver boletin-analisis.ts). De
// ahí salen a dos lugares:
//   - la web (/normativa y el riel de la home), con la ficha de lectura;
//   - `news-context`, sólo las relevantes, para que el Redactor escriba sobre
//     cambios regulatorios con la norma como fuente y no con prensa de segunda
//     mano.
//
// El archivo es permanente; la copia en `news-context` es efímera y la poda
// rss-fetcher a los 7 días. Por eso el espejado ocurre una sola vez, al
// terminar el análisis, y no en cada corrida.
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
import {
  analisisEsUtil,
  analizarNorma,
  RELEVANCIA_MINIMA,
  type NormaAnalisis,
} from "./boletin-analisis";

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
  /** Which search term brought it in — útil para tunear DEFAULT_BO_TERMS. */
  terminoOrigen: string | null;
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
      terminoOrigen: null, // lo completa el llamador, que sabe qué término buscó
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
 *
 * Los techos son GENEROSOS a propósito. Con 24.000 caracteres de HTML y 2.000
 * de texto —lo que había cuando esto sólo alimentaba un snippet— una
 * resolución con anexos se cortaba dentro del VISTO: el análisis terminaba
 * resumiendo de qué expediente viene la norma en vez de qué dispone. La parte
 * que importa (VISTO, CONSIDERANDO y los ARTÍCULOS) entra holgada en 60.000.
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
      .slice(openEnd + 1, openEnd + 200000)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const text = stripTags(chunk);
    return text.length > 40 ? text.slice(0, 60000) : null;
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
  opts?: {
    terms?: string[];
    sinceDays?: number;
    timeoutMs?: number;
    delayMs?: number;
    /**
     * URLs ya archivadas. Se listan igual (la búsqueda es una sola request por
     * término) pero se saltea la bajada de su detalle: con una ventana de 7
     * días, cada norma aparecería 7 veces y bajaríamos su texto 7 veces contra
     * un sitio ajeno para guardar exactamente lo mismo.
     */
    knownUrls?: Set<string>;
  },
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
      for (const item of recent) {
        // Primer término que la trae gana: los términos se recorren en orden y
        // el más específico ("REPROCANN") está después del genérico, así que
        // sobreescribir sólo cambiaría la atribución por la más vaga.
        if (byUrl.has(item.url)) continue;
        item.terminoOrigen = term;
        byUrl.set(item.url, item);
      }
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
  const known = opts?.knownUrls;
  const pending = items.filter((i) => !known?.has(i.url));
  let enriched = 0;
  for (const item of pending) {
    const full = await fetchAvisoDetail(item.url, timeoutMs);
    if (full && full.length > item.summary.length) {
      item.summary = full;
      enriched += 1;
    }
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }
  strapi.log.info(
    `[boletin-oficial] Texto completo obtenido para ${enriched}/${pending.length} normas nuevas` +
      (known && items.length > pending.length
        ? ` (${items.length - pending.length} ya archivadas, no se re-descargan).`
        : "."),
  );

  return items;
}

// ---------------------------------------------------------------------------
// Sync — archivo permanente en `norma` + copia efímera en `news-context`
// ---------------------------------------------------------------------------

/** Fila de `norma` en lo que a este módulo le interesa. */
type NormaRow = {
  documentId: string;
  url: string;
  titulo: string;
  norma: string | null;
  rubro: string | null;
  textoCompleto: string | null;
  analisisEstado: string;
};

export type SyncBoletinResult = {
  /** Normas devueltas por la búsqueda dentro de la ventana. */
  encontradas: number;
  /** Normas que no estaban archivadas y se crearon en esta corrida. */
  nuevas: number;
  /** Normas analizadas con éxito (incluye reintentos de corridas anteriores). */
  analizadas: number;
  /** De las analizadas, cuántas superaron el umbral de relevancia. */
  relevantes: number;
  /** Análisis que fallaron y quedaron para reintentar. */
  errores: number;
};

/** El título como lo ve el Redactor y el admin: "Ley 27669 — Título". */
function tituloConNorma(item: { titulo: string; norma?: string | null }): string {
  return item.norma ? `${item.norma} — ${item.titulo}` : item.titulo;
}

/**
 * Lo que se le pasa al Redactor: el resumen en lenguaje llano más los cambios
 * concretos. NO el texto legal crudo — que era lo que se guardaba antes y
 * llegaba al prompt como 300 caracteres de VISTO y considerandos.
 */
function resumenParaContexto(a: NormaAnalisis): string {
  return [
    a.resumen ?? "",
    a.queCambia.length > 0 ? `Qué cambia: ${a.queCambia.join(" · ")}` : "",
    a.aQuienAfecta.length > 0 ? `Alcanza a: ${a.aQuienAfecta.join(", ")}` : "",
    a.vigencia ? `Vigencia: ${a.vigencia}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

/**
 * Copia una norma relevante al pool del Redactor.
 *
 * Se llama SÓLO al terminar de analizarla, nunca sobre el archivo entero: las
 * filas de `news-context` se podan a los 7 días (pruneOldNews en rss-fetcher),
 * así que re-espejar el archivo completo en cada corrida le devolvería al
 * Redactor las mismas normas para siempre.
 */
async function espejarEnNewsContext(
  strapi: Core.Strapi,
  row: NormaRow,
  analisis: NormaAnalisis,
  publicadaEl: Date | null,
): Promise<void> {
  const fetchedAt = new Date();
  try {
    await strapi.documents("api::news-context.news-context").create({
      data: {
        title: tituloConNorma({ titulo: row.titulo, norma: row.norma }).slice(0, 255),
        url: row.url,
        source: row.rubro ? `Boletín Oficial · ${row.rubro}` : "Boletín Oficial",
        summary: resumenParaContexto(analisis),
        itemPublishedAt: publicadaEl ?? fetchedAt,
        fetchedAt,
      },
    });
  } catch {
    // `url` es único: si la norma todavía está en la ventana de 7 días desde un
    // reintento anterior, el insert choca y no hay nada que hacer.
    strapi.log.debug(`[boletin-oficial] Ya estaba en news-context: ${row.url}`);
  }
}

/**
 * Analiza las normas pendientes (y reintenta las que fallaron), y espeja las
 * relevantes en `news-context`.
 *
 * Secuencial y con tope: son ~4 por día en régimen, pero un primer arranque
 * puede traer varias decenas y no hay razón para disparar 50 llamadas juntas.
 * Cada fallo es suave: la fila queda en "error" con el mensaje y el cron del
 * día siguiente la reintenta sin volver a descargar el texto.
 */
async function analizarPendientes(
  strapi: Core.Strapi,
  maxAnalisis: number,
): Promise<{ analizadas: number; relevantes: number; errores: number }> {
  const pendientes = (await strapi.documents("api::norma.norma").findMany({
    filters: { analisisEstado: { $in: ["pendiente", "error"] } },
    sort: { publicadaEl: "desc" },
    limit: maxAnalisis,
  })) as unknown as Array<NormaRow & { publicadaEl: string | null }>;

  if (pendientes.length === 0) return { analizadas: 0, relevantes: 0, errores: 0 };

  strapi.log.info(`[boletin-oficial] Analizando ${pendientes.length} normas pendientes…`);

  let analizadas = 0;
  let relevantes = 0;
  let errores = 0;

  for (const row of pendientes) {
    const texto = row.textoCompleto?.trim();
    if (!texto) {
      // Sin texto no hay nada que leer: el detalle no se pudo bajar. Se marca
      // como error para que el reintento vuelva a pasar por acá, pero no se
      // gasta una llamada al modelo sobre un título suelto.
      await strapi.documents("api::norma.norma").update({
        documentId: row.documentId,
        data: { analisisEstado: "error", analisisError: "Sin texto de la norma" },
      });
      errores += 1;
      continue;
    }

    try {
      const { analisis, modelo } = await analizarNorma(strapi, {
        titulo: row.titulo,
        norma: row.norma,
        rubro: row.rubro,
        texto,
      });

      const util = analisisEsUtil(analisis);
      const esRelevante = analisis.relevancia >= RELEVANCIA_MINIMA;

      await strapi.documents("api::norma.norma").update({
        documentId: row.documentId,
        data: {
          ...analisis,
          analisisEstado: !util ? "error" : esRelevante ? "listo" : "descartada",
          analisisError: util ? null : "Relevante pero sin resumen; se reintenta",
          analizadaEl: new Date(),
          analisisModelo: modelo,
        },
      });

      if (!util) {
        errores += 1;
        continue;
      }

      analizadas += 1;
      if (esRelevante) {
        relevantes += 1;
        await espejarEnNewsContext(
          strapi,
          row,
          analisis,
          row.publicadaEl ? new Date(row.publicadaEl) : null,
        );
      }
    } catch (err) {
      // Falla suave: sin OPENAI_API_KEY, con la API caída o con un timeout, la
      // norma queda archivada con su texto y se reintenta mañana. El sitio
      // sigue funcionando: la web sólo muestra las que están en "listo".
      const message = (err as Error).message;
      strapi.log.warn(`[boletin-oficial] Análisis falló para ${row.url}: ${message}`);
      await strapi.documents("api::norma.norma").update({
        documentId: row.documentId,
        data: { analisisEstado: "error", analisisError: message.slice(0, 500) },
      });
      errores += 1;
    }
  }

  return { analizadas, relevantes, errores };
}

/**
 * Ciclo completo: buscar, archivar y analizar.
 *
 * El archivo (`norma`) es permanente; `news-context` recibe sólo una copia de
 * las relevantes, con el resumen legible en vez del texto legal, y se poda a
 * los 7 días como cualquier otra noticia.
 */
export async function syncBoletinOficial(
  strapi: Core.Strapi,
  opts?: { terms?: string[]; sinceDays?: number; maxAnalisis?: number },
): Promise<SyncBoletinResult> {
  // Se consulta el archivo ANTES de buscar, para saber de cuáles no hace falta
  // volver a bajar el texto.
  const archivadas = (await strapi
    .documents("api::norma.norma")
    .findMany({ fields: ["url"], limit: -1 })) as unknown as Array<{ url: string }>;
  const knownUrls = new Set(archivadas.map((n) => n.url));

  const items = await fetchRecentBoletinItems(strapi, { ...opts, knownUrls });

  const syncedAt = new Date();
  let nuevas = 0;
  for (const item of items) {
    if (knownUrls.has(item.url)) continue;
    try {
      await strapi.documents("api::norma.norma").create({
        data: {
          url: item.url,
          titulo: item.title.slice(0, 500),
          norma: item.norma,
          rubro: item.rubro,
          publicadaEl: item.itemPublishedAt ?? syncedAt,
          textoCompleto: item.summary,
          terminoOrigen: item.terminoOrigen,
          analisisEstado: "pendiente",
          syncedAt,
        },
      });
      nuevas += 1;
    } catch (err) {
      // `url` es único: una carrera con otra corrida cae acá y no es un fallo.
      strapi.log.debug(`[boletin-oficial] No se pudo archivar ${item.url}: ${err}`);
    }
  }

  strapi.log.info(
    `[boletin-oficial] ${items.length} normas en la ventana, ${nuevas} nuevas archivadas.`,
  );

  const analisis = await analizarPendientes(strapi, opts?.maxAnalisis ?? 25);

  return { encontradas: items.length, nuevas, ...analisis };
}
