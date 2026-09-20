import type { Core } from "@strapi/strapi";
import * as rssScope from "../verticals/rss-scope";
import * as project from "./project";

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

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
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
    const summary = extractField(block, "description");
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
 * Un medio cannábico especializado publica cada dos o tres días. Con 24 h sus
 * notas se descartaban acá mismo, antes de llegar a la base: medido, El Planteo
 * tenía 50 notas en su feed y 0 dentro de las 24 h; Cáñamo, 100 y 0; Filter,
 * 10 y 0. El pool quedaba con el flujo de los generalistas (~89 %) y lo único
 * cannábico eran las normas del Boletín, así que todas las notas salían
 * regulatorias. Ampliar solo la ventana de consumo no alcanza: si el ítem no
 * se guarda, no existe.
 */
const INGEST_WINDOW_DAYS = 7;

/** Clave en el core store con el ISO de la última corrida completa del cron. */
const RSS_LAST_RUN_KEY = project.coreStoreKey("rss-last-run");

export async function getRssLastRun(strapi: Core.Strapi): Promise<string | null> {
  const value = await strapi.store({ type: "core" }).get({ key: RSS_LAST_RUN_KEY });
  return typeof value === "string" ? value : null;
}

function isRecentEnough(item: NewsItem): boolean {
  if (!item.itemPublishedAt) return true;
  return (
    item.itemPublishedAt.getTime() >= Date.now() - INGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
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
      freshItems: number;
      samples: Array<{ title: string; url: string; pubDate: string | null }>;
    };

export async function validateFeed(
  feedUrl: string,
  timeoutMs = 8000,
): Promise<FeedValidationResult> {
  if (!feedUrl || !/^https?:\/\//i.test(feedUrl)) {
    return { valid: false, error: "URL inválida (debe empezar con http:// o https://)" };
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

  const freshItems = items.filter(isRecentEnough).length;
  const samples = items.slice(0, 5).map((i) => ({
    title: i.title,
    url: i.url,
    pubDate: i.itemPublishedAt ? i.itemPublishedAt.toISOString() : null,
  }));

  return {
    valid: true,
    feedTitle: feedTitle.slice(0, 200),
    feedLink,
    language,
    totalItems: items.length,
    freshItems,
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

async function pruneOldNews(strapi: Core.Strapi): Promise<void> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
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
      const fresh = r.value.filter(isRecentEnough);
      strapi.log.info(`[rss-fetcher] ${feeds[i].name}: ${fresh.length} items (últimos ${INGEST_WINDOW_DAYS} días)`);
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

  await pruneOldNews(strapi);

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
  // Ventana de 7 días, no de 24 h. Un medio cannábico especializado publica
  // cada dos o tres días: con 24 h sus notas quedaban afuera antes de que un
  // redactor las viera y el pool se llenaba solo de normativa. Medido: El
  // Planteo tenía 50 notas y 0 dentro de las últimas 24 h; Cáñamo, 100 y 0.
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

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
