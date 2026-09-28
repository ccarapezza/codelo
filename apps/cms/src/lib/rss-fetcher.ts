import type { Core } from "@strapi/strapi";
import * as rssScope from "../verticals/rss-scope";
import * as project from "./project";
import { esUrlPublica, motivoDescarte } from "./url-guard";

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  summary: string;
  itemPublishedAt: Date | null;
};

type FeedSource = {
  documentId: string;
  name: string;
  url: string;
};

// ---------------------------------------------------------------------------
// XML helpers — no external dependencies, pure regex on Node 22 native fetch
// ---------------------------------------------------------------------------

// Las entidades NUMÉRICAS van primero y de forma general: los feeds están
// llenas de ellas (&#160; por el espacio duro, &#8217; por la comilla tipográfica)
// y la lista fija de nombres no las cubría. Se veían crudas en el panel —
// "Cannabinoid&#160;Supplier"— pero el daño real es que ese título es el que le
// llega al redactor como contexto.
const ENTIDADES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  laquo: "«", raquo: "»", ldquo: "\u201c", rdquo: "\u201d",
  lsquo: "\u2018", rsquo: "\u2019", hellip: "…", mdash: "—", ndash: "–",
};

/** Exportada para poder testearla sin red ni base de datos. */
export function decodeEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTIDADES[name.toLowerCase()] ?? m);
}

// Los feeds de WordPress con imagen destacada mandan la miniatura como
// `<description>`: el resumen entero es un `<img>` y no tiene un solo hecho.
// El daño no es estético. El redactor recibe un titular que promete un dato
// ("Precio de la Soja hoy") y un resumen sin contenido, así que rellena el
// hueco inventando; y el Director, que revisa contra esos mismos 300
// caracteres, se los come el markup y no puede verificar nada. Además el HTML
// entraba al haystack de `isEditoriallyRelevant`, donde un nombre de archivo
// como `soja-dolar-1024x538.webp` hacía matchear "soja".
/** Exportada para poder testearla sin red ni base de datos. */
export function stripHtml(str: string): string {
  const sinTags = str
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, " ")
    .replace(/<[^>]+>/g, "");
  // Las entidades se decodifican DESPUÉS de sacar las etiquetas: dentro de un
  // CDATA el HTML viene crudo y sin decodificar, y al revés un `&lt;img&gt;`
  // escapado se volvería etiqueta recién después del strip.
  return decodeEntities(sinTags).replace(/\s+/g, " ").trim();
}

function safeFromCodePoint(cp: number): string {
  // Un código inválido en un feed ajeno no debe tirar una excepción y cortar la
  // ingesta entera: se deja el texto como vino.
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return "";
  try {
    return String.fromCodePoint(cp);
  } catch {
    return "";
  }
}

function extractCdata(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdata ? cdata[1].trim() : decodeEntities(raw.trim());
}

function extractField(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? extractCdata(m[1]) : "";
}

function parseItems(feedXml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(feedXml)) !== null) {
    const block = match[1];
    const title = extractField(block, "title");
    const url = extractField(block, "link") || extractField(block, "guid");
    // `description` limpio de etiquetas; si queda vacío —el caso de la
    // miniatura suelta— se recurre a `content:encoded`, que en los feeds de
    // WordPress trae el cuerpo de la nota. Un ítem que igual queda sin resumen
    // es sólo un titular, y como tal debe tratarse: no es evidencia verificable.
    const summary =
      stripHtml(extractField(block, "description")) ||
      stripHtml(extractField(block, "content:encoded"));
    const pubDateStr = extractField(block, "pubDate") || extractField(block, "dc:date");

    if (!title || !url) continue;

    let itemPublishedAt: Date | null = null;
    if (pubDateStr) {
      const d = new Date(pubDateStr);
      itemPublishedAt = isNaN(d.getTime()) ? null : d;
    }

    items.push({ title, url, source, summary, itemPublishedAt });
  }

  return items;
}

// ⚠️ Esta función TIRA el error en vez de tragárselo. Antes devolvía `[]` ante
// cualquier fallo (red, HTTP 404, HTML en vez de XML), lo que hacía a un feed
// muerto indistinguible de uno sano sin novedades: el ciclo lo contaba como
// éxito y el admin no tenía cómo enterarse. El caller lo envuelve en
// allSettled, así que un feed caído sigue sin tumbar a los otros 25.
async function fetchFeed(feedUrl: string, source: string, timeoutMs = 8000): Promise<NewsItem[]> {
  if (!esUrlPublica(feedUrl)) throw new Error(motivoDescarte(feedUrl));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": project.userAgent },
    });
  } catch (err) {
    const msg = (err as Error).message || "fetch failed";
    throw new Error(
      msg.includes("aborted")
        ? `Timeout (>${timeoutMs / 1000}s) — el servidor no respondió`
        : `Error de red: ${msg}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const xml = await res.text();
  // Un feed que se mudó suele responder 200 con el HTML de una landing: parsea
  // a cero items y pasaría como "sano pero sin novedades" para siempre.
  if (!xml.includes("<item") && !xml.includes("<entry")) {
    throw new Error("La respuesta no parece un feed RSS/Atom (sin <item> ni <entry>)");
  }
  return parseItems(xml, source);
}

/**
 * Ventana de INGESTA: 7 días, no 24 h.
 *
 * Un medio especializado de nicho publica cada dos o tres días. Con 24 h sus
 * notas se descartaban acá mismo, antes de llegar a la base: medido sobre tres
 * feeds de nicho reales, tenían 50, 100 y 10 notas en el feed y CERO dentro de
 * las 24 h. El pool quedaba con el flujo de los generalistas (~89 %) y lo único
 * del tema eran fuentes oficiales, así que todas las notas salían regulatorias. Ampliar solo la ventana de consumo no alcanza: si el ítem no
 * se guarda, no existe.
 */
/**
 * Ventana por defecto. El valor efectivo sale de Site Settings
 * (`ingestWindowDays`): con 7 días un feed que publica una nota por mes no
 * aporta nunca, y no había forma de cambiarlo sin tocar el código.
 */
const INGEST_WINDOW_DAYS = 7;

/**
 * La ventana configurada, en días.
 *
 * ⚠️ Gobierna TRES cosas que tienen que moverse juntas: qué se ingiere, cuánto
 * se conserva antes de podar, y qué ve el Redactor en su pool. Si la ingesta
 * mirara 30 días y el podado siguiera en 7, lo ingerido se borraría en el
 * ciclo siguiente y el efecto sería nulo.
 */
export async function getIngestWindowDays(strapi: Core.Strapi): Promise<number> {
  try {
    const cfg = (await strapi
      .documents("api::site-setting.site-setting")
      .findFirst({ fields: ["ingestWindowDays"] })) as unknown as {
      ingestWindowDays?: number | null;
    } | null;
    const n = Number(cfg?.ingestWindowDays);
    if (Number.isFinite(n) && n >= 1 && n <= 90) return Math.trunc(n);
  } catch {
    // Falla suave: sin ajustes cargados vale el default del motor.
  }
  return INGEST_WINDOW_DAYS;
}

/**
 * Cómo se nombra la ventana en un prompt: "last 24h" con un día —el texto que
 * el redactor tenía fijo— y "last N days" con cualquier otra.
 *
 * El prompt decía "last 24h" mientras la ventana real era de 7 días, así que
 * el modelo trataba como del día noticias de una semana atrás.
 */
export function ingestWindowLabel(dias: number): string {
  return dias === 1 ? "last 24h" : `last ${dias} days`;
}

/** Clave en el core store con el ISO de la última corrida completa del cron. */
const RSS_LAST_RUN_KEY = project.coreStoreKey("rss-last-run");

export async function getRssLastRun(strapi: Core.Strapi): Promise<string | null> {
  const value = await strapi.store({ type: "core" }).get({ key: RSS_LAST_RUN_KEY });
  return typeof value === "string" ? value : null;
}

function isRecentEnough(item: NewsItem, dias: number): boolean {
  // Un ítem SIN fecha pasa siempre: varios feeds no ponen pubDate y
  // descartarlos por eso dejaría al redactor sin material sin explicar por qué.
  if (!item.itemPublishedAt) return true;
  return item.itemPublishedAt.getTime() >= Date.now() - dias * 24 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// Feed validator — used by the admin UI to verify a feed BEFORE saving it.
// Performs a live fetch + parse and returns metadata + sample items.
// Does NOT touch the DB.
// ---------------------------------------------------------------------------

export type FeedValidationResult =
  | { valid: false; error: string }
  | {
      valid: true;
      feedTitle: string;
      feedLink: string | null;
      language: string | null;
      totalItems: number;
      /** Ítems dentro de la ventana de ingesta (`windowDays`). */
      freshItems: number;
      /** La ventana con la que se contaron los frescos, para que el panel la nombre. */
      windowDays: number;
      samples: Array<{ title: string; url: string; pubDate: string | null; summary: string }>;
    };

/**
 * @param sampleSize cuántos items devolver. El default de 5 es el que muestra
 * el botón "validar" de la pantalla de fuentes. El buscador de fuentes pide
 * más: con 5 titulares el porcentaje de match con el tema salta de 0 a 20 % de
 * a un item y no distingue un medio de nicho de uno generalista.
 * @param windowDays la ventana de ingesta configurada (`getIngestWindowDays`):
 * "frescos" tiene que querer decir lo mismo acá que en la ingesta, o el panel
 * promete ítems que el cron después descarta.
 */
export async function validateFeed(
  feedUrl: string,
  timeoutMs = 8000,
  sampleSize = 5,
  windowDays = INGEST_WINDOW_DAYS,
): Promise<FeedValidationResult> {
  if (!feedUrl || !/^https?:\/\//i.test(feedUrl)) {
    return { valid: false, error: "URL inválida (debe empezar con http:// o https://)" };
  }

  if (!esUrlPublica(feedUrl)) {
    return {
      valid: false,
      error:
        "Esa dirección apunta a la red interna o no es http(s), así que el motor no la pide. " +
        "Si el medio publica su feed en una IP privada, pedile la URL pública.",
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": project.userAgent },
    });
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message || "fetch failed";
    return {
      valid: false,
      error: msg.includes("aborted")
        ? `Timeout (>${timeoutMs / 1000}s) — el servidor no respondió`
        : `Error de red: ${msg}`,
    };
  }
  clearTimeout(timer);

  if (!res.ok) {
    return { valid: false, error: `HTTP ${res.status} ${res.statusText}` };
  }

  const xml = await res.text();
  if (!xml.includes("<item") && !xml.includes("<entry")) {
    return {
      valid: false,
      error: "La respuesta no contiene <item> ni <entry>; no parece un feed RSS/Atom válido.",
    };
  }

  const items = parseItems(xml, "preview");
  if (items.length === 0) {
    return {
      valid: false,
      error: "Se parseó el XML pero no se encontró ningún item con título y link.",
    };
  }

  // Channel metadata (best effort — handles both RSS <channel> and Atom roots).
  const channelMatch = xml.match(/<channel[^>]*>([\s\S]*?)<\/channel>/i);
  const channelXml = channelMatch ? channelMatch[1] : xml;
  const feedTitle =
    extractField(channelXml, "title") || extractField(xml, "title") || "(sin título)";
  const feedLink = extractField(channelXml, "link") || null;
  const language = extractField(channelXml, "language") || null;

  const freshItems = items.filter((i) => isRecentEnough(i, windowDays)).length;
  const samples = items.slice(0, sampleSize).map((i) => ({
    title: i.title,
    url: i.url,
    pubDate: i.itemPublishedAt ? i.itemPublishedAt.toISOString() : null,
    summary: i.summary,
  }));

  return {
    valid: true,
    feedTitle: feedTitle.slice(0, 200),
    feedLink,
    language,
    totalItems: items.length,
    freshItems,
    windowDays,
    samples,
  };
}

async function loadEnabledFeeds(
  strapi: Core.Strapi,
  onlyDocumentId?: string,
): Promise<FeedSource[]> {
  const filters: Record<string, unknown> = { enabled: true };
  if (onlyDocumentId) filters["documentId"] = onlyDocumentId;
  return (await strapi
    .documents("api::rss-feed.rss-feed")
    .findMany({ filters })) as unknown as FeedSource[];
}

async function pruneOldNews(strapi: Core.Strapi, dias: number): Promise<void> {
  const weekAgo = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const old = (await strapi
    .documents("api::news-context.news-context")
    .findMany({ filters: { fetchedAt: { $lt: weekAgo.toISOString() } } })) as unknown as Array<{
    documentId: string;
  }>;
  for (const item of old) {
    await strapi
      .documents("api::news-context.news-context")
      .delete({ documentId: item.documentId });
  }
  if (old.length > 0) {
    strapi.log.info(`[rss-fetcher] Pruned ${old.length} stale news items.`);
  }
}


// ---------------------------------------------------------------------------
// Enriquecimiento — cuando el feed no trae resumen
// ---------------------------------------------------------------------------

/** Tope por ciclo. Cada uno es una petición al medio: no se abusa. */
const TOPE_ENRIQUECER = 15;

/**
 * La descripción que el propio medio declara para esa nota.
 *
 * Se lee `og:description` (y `<meta name="description">` como respaldo) en vez
 * de intentar extraer el cuerpo del HTML. No es pereza: medido el 24/09/2026
 * sobre 10 notas reales de los feeds cargados, `og:description` apareció en
 * las 10 y con una frase que dice de qué se trata; la extracción de párrafos
 * devolvió 0 en las mismas páginas, porque el cuerpo o no está en `<p>` o lo
 * arma JavaScript. Una frase escrita por el medio es mejor evidencia que un
 * raspado a medias.
 *
 * Exportada para poder testearla sin red.
 */
export function descripcionDePagina(html: string): string {
  const patrones = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{40,})["']/i,
    /<meta[^>]+content=["']([^"']{40,})["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{40,})["']/i,
    /<meta[^>]+content=["']([^"']{40,})["'][^>]+name=["']description["']/i,
  ];
  for (const re of patrones) {
    const m = html.match(re);
    // Las entidades se decodifican acá: vienen escapadas dentro del atributo
    // (`&quot;`, `&#039;`) y sin esto llegan crudas al prompt del redactor.
    if (m) return decodeEntities(m[1]).replace(/\s+/g, " ").trim();
  }
  return "";
}

/**
 * Le completa el resumen a los ítems que llegaron sin uno.
 *
 * Los feeds de miniatura —y los de Google News— traen un `<description>` que
 * después de limpiar el HTML queda vacío. Un ítem así es sólo un titular: el
 * redactor lee una promesa de dato y rellena inventando, y el Director no
 * tiene contra qué verificar. Bajarse la nota y leer lo que el medio declara
 * cierra ese agujero.
 *
 * Muta los ítems recibidos. Falla suave de a uno: si un medio no responde, ese
 * ítem se queda como estaba y el ciclo sigue.
 */
async function enriquecerSinResumen(strapi: Core.Strapi, items: NewsItem[]): Promise<void> {
  const sinResumen = items.filter((i) => !i.summary?.trim() && esUrlPublica(i.url));
  if (sinResumen.length === 0) return;

  const objetivo = sinResumen.slice(0, TOPE_ENRIQUECER);
  let completados = 0;

  // De a cuatro: son medios distintos, pero no hay razón para golpearlos todos
  // a la vez.
  for (let i = 0; i < objetivo.length; i += 4) {
    await Promise.all(
      objetivo.slice(i, i + 4).map(async (item) => {
        try {
          const res = await fetch(item.url, {
            headers: { "User-Agent": project.userAgent },
            signal: AbortSignal.timeout(9000),
            redirect: "follow",
          });
          if (!res.ok) return;
          const desc = descripcionDePagina(await res.text());
          if (desc) {
            item.summary = desc;
            completados += 1;
          }
        } catch {
          /* el medio no respondió: el ítem queda como titular suelto */
        }
      }),
    );
  }

  strapi.log.info(
    `[rss-fetcher] Resumen completado en ${completados} de ${sinResumen.length} ítems que vinieron sin uno` +
      (sinResumen.length > TOPE_ENRIQUECER ? ` (tope ${TOPE_ENRIQUECER} por ciclo)` : ""),
  );
}

export async function fetchAndSaveNews(
  strapi: Core.Strapi,
  onlyDocumentId?: string,
): Promise<void> {
  strapi.log.info("[rss-fetcher] Starting RSS fetch cycle…");

  const feeds = await loadEnabledFeeds(strapi, onlyDocumentId);
  if (feeds.length === 0) {
    strapi.log.info("[rss-fetcher] No enabled feeds configured.");
    return;
  }

  // Una sola lectura para todo el ciclo: ingesta, podado y pool del redactor
  // tienen que mirar la MISMA ventana (ver getIngestWindowDays).
  const dias = await getIngestWindowDays(strapi);

  const results = await Promise.allSettled(
    feeds.map((f) => fetchFeed(f.url, f.name)),
  );

  // Estado por feed. Antes se estampaba lastFetchedAt en TODOS los feeds al
  // final del ciclo, hubieran respondido o no: un feed muerto seguía mostrando
  // "último fetch: hace 2m" en el admin y no había forma de verlo desde la UI.
  // Ahora la marca de tiempo sólo avanza si el feed respondió, y el error del
  // último intento queda persistido para pintarlo en la tabla.
  const outcomes: Array<{ freshCount: number; error: string | null }> = [];
  const allItems: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const fresh = r.value.filter((i) => isRecentEnough(i, dias));
      strapi.log.info(`[rss-fetcher] ${feeds[i].name}: ${fresh.length} items (últimos ${dias} días)`);
      allItems.push(...fresh);
      outcomes.push({ freshCount: fresh.length, error: null });
    } else {
      strapi.log.warn(`[rss-fetcher] ${feeds[i].name} failed:`, r.reason);
      const reason = r.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "error desconocido");
      outcomes.push({ freshCount: 0, error: message.slice(0, 500) });
    }
  });

  if (allItems.length > 0) {
    const urls = allItems.map((i) => i.url);
    const existing = (await strapi
      .documents("api::news-context.news-context")
      .findMany({ filters: { url: { $in: urls } } })) as unknown as Array<{ url: string }>;
    const existingUrls = new Set(existing.map((e) => e.url));
    const toCreate = allItems.filter((i) => !existingUrls.has(i.url));

    strapi.log.info(
      `[rss-fetcher] ${toCreate.length} new items (${existingUrls.size} already existed).`,
    );

    // Sólo sobre los nuevos: re-pedir en cada ciclo una nota ya guardada sería
    // gratis para nosotros y molesto para el medio.
    await enriquecerSinResumen(strapi, toCreate);

    const fetchedAt = new Date();
    for (const item of toCreate) {
      try {
        await strapi.documents("api::news-context.news-context").create({
          data: {
            title: item.title.slice(0, 255),
            url: item.url,
            source: item.source,
            summary: item.summary.slice(0, 2000),
            itemPublishedAt: item.itemPublishedAt ?? fetchedAt,
            fetchedAt,
          },
        });
      } catch {
        strapi.log.debug(`[rss-fetcher] Skip duplicate: ${item.url}`);
      }
    }
  }

  // lastFetchedAt = último fetch EXITOSO (por eso no se toca cuando falla:
  // que quede viejo es justamente la señal de "este feed dejó de responder").
  // lastError se limpia en cada éxito para que no quede un error viejo pegado.
  const now = new Date().toISOString();
  for (const [i, feed] of feeds.entries()) {
    const outcome = outcomes[i];
    const data = outcome.error
      ? { lastError: outcome.error }
      : { lastFetchedAt: now, lastError: null, lastItemCount: outcome.freshCount };
    await strapi.documents("api::rss-feed.rss-feed").update({ documentId: feed.documentId, data });
  }

  await pruneOldNews(strapi, dias);

  // Marca del ciclo completo, para que el admin pueda mostrar cuándo corrió el
  // cron por última vez. Sólo en la corrida completa: un "fetch ahora" sobre un
  // feed suelto no es un ciclo y no debe mover esta marca.
  if (!onlyDocumentId) {
    await strapi.store({ type: "core" }).set({ key: RSS_LAST_RUN_KEY, value: now });
  }

  strapi.log.info("[rss-fetcher] RSS fetch cycle complete.");
}

// ---------------------------------------------------------------------------
// Relevancia editorial
//
// Mecanismo genérico; las palabras del vertical viven en verticals/rss-scope.ts.
// Sirve para los caminos que NO filtran por tema en la consulta —el pool de
// `planBatch()` se arma con topic vacío—, donde los feeds generalistas dominan
// por volumen y el redactor termina escribiendo del tema equivocado con toda
// diligencia.
//
// Con las listas vacías deja pasar todo, así que activarlo no cambia nada hasta
// que el vertical las complete.

// Coincidencia de palabra (o frase) completa, con soporte de acentos. Evita que
// "river" matchee dentro de "riverside" sin perder los nombres con tilde.
function matchesWholeWord(haystack: string, kw: string): boolean {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "u").test(haystack);
}

export function isEditoriallyRelevant(item: { title: string; summary?: string | null }): boolean {
  // Sin alcance declarado no hay nada que filtrar: pasa todo.
  if (rssScope.scope.length === 0 && rssScope.ambiguous.length === 0) return true;

  const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  if (rssScope.denylist.some((kw) => haystack.includes(kw))) return false;
  if (rssScope.scope.some((kw) => matchesWholeWord(haystack, kw))) return true;
  // Un término ambiguo sólo cuenta si hay una pista de contexto que lo confirme.
  if (!rssScope.contextCues.some((cue) => haystack.includes(cue))) return false;
  return rssScope.ambiguous.some((kw) => matchesWholeWord(haystack, kw));
}

/**
 * Palabras que NO sirven para buscar: aparecen en casi cualquier titular.
 *
 * El filtro de abajo es un `$or` sobre todas las palabras del query, así que
 * una sola stopword lo vuelve inútil. Medido contra el pool de producción el
 * 04/08/2026: el query de un borrador real matcheaba 6.082 filas incluyendo
 * "para" y "sobre", y 154 sin ellas. Como el prefiltro toma las primeras 300
 * ordenadas por fecha, el primer caso reducía la ventana a DOS HORAS de RSS y
 * el segundo cubre los 7 días enteros.
 *
 * Sólo palabras funcionales: cualquier término con carga temática se conserva,
 * aunque sea frecuente, porque distingue una nota de otra.
 */
const STOPWORDS = new Set([
  "para", "sobre", "como", "pero", "porque", "aunque", "mientras", "cuando",
  "donde", "desde", "hasta", "entre", "ante", "bajo", "contra", "según", "tras",
  "este", "esta", "estos", "estas", "esto", "ese", "esa", "esos", "esas",
  "aquel", "aquella", "todo", "toda", "todos", "todas", "otro", "otra",
  "otros", "otras", "cada", "unos", "unas", "mismo", "misma", "mismos",
  "también", "tampoco", "sólo", "solo", "además", "menos", "muy", "más",
  "ser", "son", "sea", "sean", "era", "eran", "está", "están", "estar",
  "fue", "fueron", "haber", "había", "hacer", "hace", "hacen", "tiene",
  "tienen", "tener", "puede", "pueden", "poder", "será", "serán", "hubo",
  "dice", "dijo", "según", "ello", "ellos", "ellas", "nuestro", "nuestra",
  "sus", "les", "una", "uno", "del", "las", "los", "por", "con", "que",
  "the", "this", "that", "with", "from", "have", "been", "will", "their",
  "which", "about", "after", "before", "than", "then", "these", "those",
]);

/**
 * Palabras buscables de un texto: sin stopwords, sin números sueltos y de más
 * de 3 letras. Exportada para poder testearla sin base de datos.
 */
export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,;.:¿?¡!()"'“”«»/–—-]+/)
    .filter(
      (w) =>
        w.length > 3 &&
        !STOPWORDS.has(w) &&
        // Un año ("2026") o un número suelto no distingue una nota de otra.
        !/^\d+$/.test(w),
    );
}

export async function getRecentNewsForTopic(
  strapi: Core.Strapi,
  topic: string,
  limit = 10,
): Promise<NewsItem[]> {
  // Ventana de 7 días, no de 24 h. Un medio especializado de nicho publica cada
  // dos o tres días: con 24 h sus notas quedaban afuera antes de que un redactor
  // las viera y el pool se llenaba solo de normativa. Medido sobre feeds reales:
  // 50 notas y 0 dentro de las últimas 24 h; otro, 100 y 0.
  // La misma ventana que la ingesta: si se ingieren 30 días y acá se miran 7,
  // lo que se sumó al subir la ventana no le llega nunca al redactor.
  const dias = await getIngestWindowDays(strapi);
  const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  const keywords = extractKeywords(topic);

  // El filtro por keywords va en la CONSULTA, no en memoria. Si se recorta
  // primero por fecha y se filtra después, los generalistas (Infobae y
  // compañía aportan ~89 % del pool y casi nunca hablan del tema) desplazan a
  // las fuentes de nicho fuera del tope y el redactor nunca las ve. Filtrando
  // en la query, el tope se aplica sobre lo que YA es relevante.
  const keywordFilter =
    keywords.length > 0
      ? {
          $or: keywords.flatMap((kw) => [
            { title: { $containsi: kw } },
            { summary: { $containsi: kw } },
          ]),
        }
      : {};

  // Ordenado por fetchedAt (cuándo lo ingerimos), NO por itemPublishedAt: las
  // normas del Boletín llevan la fecha de la norma (semanas atrás) y por
  // itemPublishedAt caían siempre al fondo.
  //
  // ⚠️ Este tope se aplica ANTES de puntuar y ordenado por fecha, así que
  // recorta por lo más nuevo, no por lo más relevante: todo lo que quede
  // afuera es invisible para el scoring de abajo. Mientras el filtro sea
  // selectivo (ver STOPWORDS) el conjunto entero entra y no hay recorte real
  // —un query de borrador da ~150 filas en 7 días—, pero con un query ancho
  // el tope se vuelve una ventana de horas. 1000 deja margen para que eso no
  // vuelva a pasar en silencio si el pool sigue creciendo.
  const all = (await strapi.documents("api::news-context.news-context").findMany({
    filters: { fetchedAt: { $gte: since.toISOString() }, ...keywordFilter },
    sort: { fetchedAt: "desc" },
    limit: 1000,
  })) as unknown as Array<{
    title: string;
    url: string;
    source: string;
    summary: string;
    itemPublishedAt: string | null;
    fetchedAt: string;
  }>;

  if (all.length === 0) return [];

  let scored = all.map((item) => {
    const haystack = `${item.title} ${item.summary}`.toLowerCase();
    const score = keywords.reduce((acc, kw) => acc + (haystack.includes(kw) ? 1 : 0), 0);
    return { item, score };
  });

  if (keywords.length > 0) {
    scored = scored.filter((s) => s.score > 0);
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      title: s.item.title,
      url: s.item.url,
      source: s.item.source,
      summary: s.item.summary,
      itemPublishedAt: s.item.itemPublishedAt ? new Date(s.item.itemPublishedAt) : null,
    }));
}
