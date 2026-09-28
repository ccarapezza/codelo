// Buscador de fuentes RSS.
//
// La regla dura: NUNCA se muestra un feed que no se haya bajado. Todos los
// candidatos pasan por validateFeed antes de llegar a la pantalla, así que lo
// que se ofrece agregar existe, parsea y tiene items. Un buscador que liste
// URLs sin abrirlas es una máquina de tipear direcciones muertas.
//
// Tres fuentes de candidatos, porque ninguna sola alcanza:
//
//   1. Feedly, que tiene el catálogo pero busca LITERAL. Medido el 21/09/2026
//      sobre una decena de consultas: un término amplio de una palabra da 20
//      resultados, y ESE MISMO término con una segunda palabra al lado baja a
//      1 o a 0 — igual que cualquier término de nicho en castellano. Se cuelga
//      justo en las consultas específicas, que son las útiles.
//   2. Autodiscovery sobre un dominio, que cubre el caso "ya sé qué medio
//      quiero" y no depende de ningún tercero.
//   3. Los dominios que el usuario escriba dentro de la consulta.
//
// Todo falla suave: si Feedly se cae o cambia, el buscador sigue sirviendo con
// las otras dos vías.

import type { Core } from "@strapi/strapi";
import {
  extractKeywords,
  getIngestWindowDays,
  validateFeed,
  type FeedValidationResult,
} from "./rss-fetcher";
import { esUrlPublica } from "./url-guard";
import { buscarMedios, esEdicionValida, type CodigoEdicion } from "./google-news";
import * as project from "./project";

const UID = "api::rss-feed.rss-feed";

/** Cuántos items se bajan de cada candidato para medir de qué habla. */
const MUESTRA = 20;

/**
 * Rutas que se prueban cuando el HTML no declara su feed.
 *
 * ⚠️ El orden y las BARRAS FINALES importan, no son decorativas:
 * `ole.com.ar/rss` no devuelve nada y `ole.com.ar/rss/` sí es el feed. Sondear
 * sólo la versión sin barra perdía Olé entero.
 *
 * Y sondear no es un fallback de lujo: los medios grandes no publican su feed
 * en el HTML. Los `<link rel="alternate">` de Olé son hreflang, no feeds.
 */
const SONDAS = [
  "/feed/", "/feed", "/rss/", "/rss", "/feed.xml", "/rss.xml",
  "/atom.xml", "/index.xml", "/feeds/posts/default", "/?feed=rss2",
];

const FEEDLY_SEARCH = "https://cloud.feedly.com/v3/search/feeds";

export type FeedCandidate = {
  url: string;
  title: string;
  description: string | null;
  siteUrl: string | null;
  iconUrl: string | null;
  language: string | null;
  /** Suscriptores en Feedly. Sólo lo sabe Feedly; es señal de popularidad. */
  subscribers: number | null;
  /** Posts por semana según Feedly. */
  velocity: number | null;
  lastUpdated: string | null;
  via: "feedly" | "autodiscovery" | "sonda";
};

export type TopicMatch = { matched: number; total: number; pct: number };

export type DiscoveredFeed = FeedCandidate & {
  valid: boolean;
  error: string | null;
  totalItems: number | null;
  freshItems: number | null;
  samples: Array<{ title: string; url: string; pubDate: string | null }>;
  /** Qué porción de los items recientes habla del tema buscado. */
  topicMatch: TopicMatch | null;
  /** Ya está cargado como fuente: se muestra, pero no se puede volver a agregar. */
  alreadyAdded: boolean;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/**
 * Clave de deduplicación.
 *
 * La barra final es la diferencia entre tres resultados y uno: perfil.com
 * devolvió el MISMO feed por `/feed/`, `/feed` y `/rss/`, y clarin.com el mismo
 * por `/rss/lo-ultimo` y `/rss/lo-ultimo/`.
 */
export function feedKey(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, "");
  }
}

/** ¿La consulta es un dominio o una URL, y no un tema? */
export function looksLikeSite(q: string): boolean {
  const s = q.trim();
  if (/\s/.test(s)) return false;
  return /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/.*)?$/i.test(s);
}

async function get(url: string, timeoutMs: number): Promise<Response | null> {
  // El autodiscovery lee la URL del `<link rel="alternate">` de un sitio
  // ajeno: la elige un tercero, no el admin. Ver url-guard.ts.
  if (!esUrlPublica(url)) return null;
  try {
    return await fetch(url, {
      headers: { "User-Agent": project.userAgent },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
  } catch {
    return null;
  }
}

/** Corre `fn` sobre `items` con un tope de tareas en vuelo (ser buen vecino). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Fuente 1 — Feedly
// ---------------------------------------------------------------------------

/**
 * ⚠️ API no documentada y sin autenticación, de la misma familia que los
 * endpoints internos de cualquier organismo: puede pedir token o cambiar de
 * forma sin aviso. Por eso devuelve []
 * ante cualquier problema en vez de propagar el error — el buscador sigue
 * andando con autodiscovery.
 */
export async function searchFeedly(
  query: string,
  count = 20,
  locale: string | null = null,
): Promise<FeedCandidate[]> {
  // `locale` sesga el catálogo hacia un idioma. Ojo: sesga, no filtra, y ayuda
  // poco — medido el 21/09/2026, un término de nicho con locale=es y count=40
  // devolvía UN solo feed en castellano sobre 40. El catálogo de Feedly en
  // español es flaco de verdad; para nicho en castellano la vía que sirve es
  // autodiscovery sobre el medio que uno ya conoce. (El parámetro se llama
  // `locale`: `lang` existe pero se ignora.)
  const url =
    `${FEEDLY_SEARCH}?query=${encodeURIComponent(query)}&count=${count}` +
    (locale ? `&locale=${encodeURIComponent(locale)}` : "");
  const res = await get(url, 10000);
  if (!res || !res.ok) return [];
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return [];
  }
  const results = (json as { results?: unknown[] })?.results;
  if (!Array.isArray(results)) return [];

  const out: FeedCandidate[] = [];
  for (const r of results as Array<Record<string, unknown>>) {
    // El id de Feedly es "feed/<url>"; lo que sirve es la URL de adentro.
    const raw = typeof r.feedId === "string" ? r.feedId : typeof r.id === "string" ? r.id : "";
    const feedUrl = raw.replace(/^feed\//, "");
    if (!/^https?:\/\//i.test(feedUrl)) continue;
    out.push({
      url: feedUrl,
      title: typeof r.title === "string" ? r.title : feedUrl,
      description: typeof r.description === "string" ? r.description : null,
      siteUrl: typeof r.website === "string" ? r.website : null,
      iconUrl: typeof r.iconUrl === "string" ? r.iconUrl : null,
      language: typeof r.language === "string" ? r.language : null,
      subscribers: typeof r.subscribers === "number" ? r.subscribers : null,
      velocity: typeof r.velocity === "number" ? r.velocity : null,
      lastUpdated:
        typeof r.lastUpdated === "number" ? new Date(r.lastUpdated).toISOString() : null,
      via: "feedly",
    });
  }
  return out;
}

/**
 * Feedly con reintento por palabra suelta.
 *
 * Su búsqueda es literal, así que una consulta de dos palabras se cae por un
 * precipicio: medido el 21/09/2026, un término amplio de una palabra daba 20
 * resultados y ese mismo término con una segunda palabra al lado daba UNO, y
 * en otro caso 20 contra CERO. Sin reintento, cuanto más precisa la consulta,
 * más pobre el resultado — al revés de lo que espera quien busca.
 *
 * ⚠️ Las listas por palabra se INTERCALAN, no se concatenan. La primera versión
 * las ordenaba por largo y cortaba al llenarse, así que en una consulta de dos
 * palabras la MÁS LARGA se comía todo el cupo con sus propios resultados y la
 * otra —la que de verdad definía el tema— no llegaba a consultarse nunca. El
 * listado no traía un solo feed del tema buscado. Intercalando, ninguna palabra
 * puede acaparar el cupo.
 *
 * Qué tan pertinente es cada candidato no se decide acá: de eso se encarga
 * scoreTopicMatch, que puntúa por fracción de términos de la consulta.
 */
async function buscarEnFeedlyConReintento(
  query: string,
  count: number,
  locale: string | null,
): Promise<FeedCandidate[]> {
  const exacto = await searchFeedly(query, count, locale);
  const claves = extractKeywords(query);
  const palabras = claves.slice(0, 3);
  if (exacto.length >= 5 || palabras.length < 2) return exacto;

  // El reintento por palabra suelta descartaba en silencio todo lo que no
  // entrara en las tres primeras — y el calificador que más importa suele ir
  // al final. "gastronomía, restaurantes, cocina y vinos de Argentina" buscaba
  // "gastronomía", "restaurantes" y "cocina", tirando justo "argentina", que
  // es la palabra que decide si el resultado sirve. Se agrega el par
  // primera+última, que conserva la geografía sin multiplicar las llamadas.
  const ultima = claves[claves.length - 1];
  const consultas = [...palabras];
  if (ultima && !palabras.includes(ultima)) consultas.push(`${palabras[0]} ${ultima}`);

  const porPalabra = await Promise.all(consultas.map((p) => searchFeedly(p, count, locale)));
  const out = [...exacto];
  const vistos = new Set(out.map((c) => feedKey(c.url)));

  for (let i = 0; out.length < count; i++) {
    let quedaMaterial = false;
    for (const lista of porPalabra) {
      const c = lista[i];
      if (!c) continue;
      quedaMaterial = true;
      const k = feedKey(c.url);
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push(c);
      if (out.length >= count) break;
    }
    if (!quedaMaterial) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Fuente 2 — autodiscovery sobre un sitio
// ---------------------------------------------------------------------------

function parseAlternates(html: string, baseUrl: string): FeedCandidate[] {
  const out: FeedCandidate[] = [];
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    if (!/rel=["']?[^"'>]*alternate/i.test(tag)) continue;
    // El type es lo que separa un feed de un hreflang. Sin este chequeo,
    // ole.com.ar devuelve sus <link rel="alternate" hrefLang="es-ar"> como si
    // fueran fuentes.
    if (!/type=["']?application\/(rss|atom)\+xml/i.test(tag)) continue;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    let abs: string;
    try {
      abs = new URL(href.replace(/&amp;/g, "&"), baseUrl).href;
    } catch {
      continue;
    }
    out.push({
      url: abs,
      title: tag.match(/title=["']([^"']*)["']/i)?.[1] ?? "",
      description: null,
      siteUrl: baseUrl,
      iconUrl: null,
      language: null,
      subscribers: null,
      velocity: null,
      lastUpdated: null,
      via: "autodiscovery",
    });
  }
  return out;
}

const pareceFeed = (ct: string, body: string): boolean =>
  /xml|rss|atom/i.test(ct) || /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));

/** Feeds de un sitio: primero lo que declara el HTML, después las sondas. */
export async function discoverOnSite(site: string): Promise<FeedCandidate[]> {
  const base = /^https?:\/\//i.test(site) ? site : `https://${site}`;
  const found: FeedCandidate[] = [];

  const home = await get(base, 12000);
  if (home?.ok) {
    try {
      found.push(...parseAlternates(await home.text(), home.url));
    } catch {
      /* HTML ilegible: se sigue con las sondas */
    }
  }

  if (found.length === 0) {
    const vistos = new Set<string>();
    for (const ruta of SONDAS) {
      let probe: string;
      try {
        probe = new URL(ruta, base).href;
      } catch {
        continue;
      }
      const r = await get(probe, 8000);
      if (!r?.ok) continue;
      let body: string;
      try {
        body = await r.text();
      } catch {
        continue;
      }
      if (!pareceFeed(r.headers.get("content-type") ?? "", body)) continue;
      // Se deduplica acá mismo porque varias sondas caen en el mismo feed tras
      // los redirects (perfil.com resolvía tres rutas a la misma URL).
      const key = feedKey(r.url);
      if (vistos.has(key)) continue;
      vistos.add(key);
      found.push({
        url: r.url,
        title: "",
        description: null,
        siteUrl: base,
        iconUrl: null,
        language: null,
        subscribers: null,
        velocity: null,
        lastUpdated: null,
        via: "sonda",
      });
      if (found.length >= 3) break;
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// Puntaje de tema
// ---------------------------------------------------------------------------

/** Minúsculas y sin diacríticos: "energía" y "energia" tienen que ser lo mismo. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Raíz aproximada de una palabra, para tolerar la morfología del español.
 *
 * Sin esto el puntaje miente feo: medido el 21/09/2026, una consulta daba 0 %
 * sobre un feed cuyo NOMBRE era exactamente el tema buscado, porque el titular
 * usaba otra flexión de la misma palabra. El match por palabra entera veía
 * "receptivo" ≠ "receptores" y descartaba.
 *
 * Se cortan dos letras y nunca se baja de cuatro. Es deliberadamente burdo: el
 * porcentaje ORDENA candidatos, no filtra nada, así que un falso positivo
 * ocasional cuesta mucho menos que perder el medio que justo buscabas. Para el
 * filtro editorial de verdad está isEditoriallyRelevant, que no usa esto.
 */
function stem(kw: string): string {
  const f = fold(kw);
  return f.slice(0, Math.max(4, f.length - 2));
}

function matchesPrefix(haystack: string, st: string): boolean {
  const escaped = st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, "u").test(haystack);
}

/**
 * Qué porción de los items habla del tema buscado.
 *
 * Esta es la razón de ser del buscador. Un directorio te dice que Infobae
 * publica mucho; lo que hace falta saber antes de suscribirse es que de ese
 * mucho casi nada es del tema. Sin esta columna se repite el accidente de
 * `run-batch`: los feeds generalistas dominan el pool por volumen y los
 * redactores terminan escribiendo sobre el Día Mundial del Perro.
 *
 * Devuelve null si la consulta no deja keywords utilizables (es un dominio, o
 * son todas stopwords): mejor no mostrar número que mostrar uno inventado.
 */
export function scoreTopicMatch(
  samples: Array<{ title: string; summary?: string }>,
  query: string,
): TopicMatch | null {
  const stems = extractKeywords(query).map(stem);
  if (stems.length === 0 || samples.length === 0) return null;

  // Cada item puntúa por la FRACCIÓN de términos de la consulta que contiene,
  // no por si contiene alguno. Con "alguno" basta, una consulta de dos palabras
  // daba 100 % a feeds que sólo tocaban la palabra MÁS GENÉRICA de las dos
  // —un blog de música, otro de divulgación— y los ponía arriba del feed cuyo
  // nombre era, literalmente, el tema buscado.
  let acumulado = 0;
  let matched = 0;
  for (const s of samples) {
    const hay = fold(`${s.title} ${s.summary ?? ""}`);
    const hits = stems.filter((st) => matchesPrefix(hay, st)).length;
    if (hits > 0) matched++;
    acumulado += hits / stems.length;
  }
  return {
    matched,
    total: samples.length,
    pct: Math.round((acumulado / samples.length) * 100),
  };
}

// ---------------------------------------------------------------------------
// Orquestador
// ---------------------------------------------------------------------------

async function yaCargados(strapi: Core.Strapi): Promise<Set<string>> {
  try {
    const rows = (await strapi.documents(UID).findMany({ fields: ["url"] })) as unknown as Array<{
      url: string;
    }>;
    return new Set(rows.map((r) => feedKey(r.url)));
  } catch {
    return new Set();
  }
}

/**
 * Candidatos a partir de los medios que Google News muestra para ese tema y
 * país: se le pide su RSS propio a cada uno con el autodiscovery de siempre.
 *
 * El tope de medios es deliberado. Cada uno son una o dos peticiones al sitio,
 * y con 72 medios por consulta sin tope el buscador tardaría minutos. Los
 * primeros son los que más publicaron sobre el tema, que es el orden correcto.
 */
async function candidatosDesdeGoogleNews(
  query: string,
  code: CodigoEdicion,
  topeMedios = 14,
): Promise<FeedCandidate[]> {
  const medios = await buscarMedios(query, code, project.userAgent);
  if (medios.length === 0) return [];

  const listas = await mapLimit(medios.slice(0, topeMedios), 4, async (m) => {
    const encontrados = await discoverOnSite(m.host);
    // El nombre que le pone Google News gana al del `<title>` del feed: suele
    // ser el de la publicación y no "Inicio - Últimas noticias".
    return encontrados.slice(0, 1).map((c) => ({ ...c, title: m.nombre || c.title }));
  });
  return listas.flat();
}

export async function discoverFeeds(
  strapi: Core.Strapi,
  query: string,
  opts: { max?: number; lang?: string | null; country?: string | null } = {},
): Promise<{ query: string; feeds: DiscoveredFeed[]; sources: string[]; windowDays: number }> {
  const q = query.trim();
  // La ventana de ingesta configurada: "frescos" en el listado cuenta con la
  // misma que después usa el cron, y el panel la nombra.
  const windowDays = await getIngestWindowDays(strapi);
  const max = opts.max ?? 12;
  const lang = opts.lang?.trim().toLowerCase() || null;
  if (!q) return { query: q, feeds: [], sources: [], windowDays };

  const sources: string[] = [];
  const candidatos: FeedCandidate[] = [];

  if (looksLikeSite(q)) {
    // Consulta que es un dominio: no tiene sentido buscarla como tema.
    candidatos.push(...(await discoverOnSite(q)));
    sources.push("autodiscovery");
  } else {
    const pais = esEdicionValida(opts.country) ? opts.country : null;
    const [feedly, porDominio, porPais] = await Promise.all([
      // Con filtro de idioma se pide bastante más: lo que se descarta después
      // es casi todo, así que con el pool chico el listado quedaba vacío.
      buscarEnFeedlyConReintento(q, lang ? 60 : Math.max(max * 2, 20), lang),
      // Un dominio escrito dentro de una consulta más larga ("rss de
      // eldiarioar.com") igual se resuelve.
      (async () => {
        const dom = q.split(/\s+/).find((w) => looksLikeSite(w));
        return dom ? discoverOnSite(dom) : [];
      })(),
      pais ? candidatosDesdeGoogleNews(q, pais) : Promise.resolve([]),
    ]);
    if (feedly.length) sources.push("feedly");
    if (porDominio.length) sources.push("autodiscovery");
    if (porPais.length) sources.push("google-news");
    // Los del país van PRIMERO: el dedupe conserva el primero que aparece, y
    // cuando un medio está en los dos lados el que importa es el local.
    candidatos.push(...porDominio, ...porPais, ...feedly);
  }

  // Dedupe conservando el primero, que es el de la fuente más específica.
  const vistos = new Set<string>();
  const unicos = candidatos.filter((c) => {
    const k = feedKey(c.url);
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  const cargados = await yaCargados(strapi);

  // Se valida un poco más de lo que se va a mostrar: varios candidatos de
  // Feedly resultan muertos o caídos y si no, el listado queda corto.
  const aValidar = unicos.slice(0, max + 8);
  const validados = await mapLimit(aValidar, 5, async (c): Promise<DiscoveredFeed> => {
    const r = await validateFeed(c.url, 8000, MUESTRA, windowDays);
    const base = { ...c, alreadyAdded: cargados.has(feedKey(c.url)) };
    if (!r.valid) {
      // El tsconfig del CMS tiene `strict: false`, y sin strictNullChecks TS no
      // angosta la unión por el discriminante booleano. El Extract dice lo que
      // el `if` ya garantiza.
      const fallo = r as Extract<FeedValidationResult, { valid: false }>;
      return {
        ...base,
        valid: false,
        error: fallo.error,
        totalItems: null,
        freshItems: null,
        samples: [],
        topicMatch: null,
      };
    }
    const ok = r as Extract<FeedValidationResult, { valid: true }>;
    return {
      ...base,
      // El título del feed real gana al del directorio: Feedly cachea nombres
      // viejos, y las sondas no traen ninguno.
      title: ok.feedTitle || c.title || c.url,
      siteUrl: c.siteUrl ?? ok.feedLink,
      language: c.language ?? ok.language,
      valid: true,
      error: null,
      totalItems: ok.totalItems,
      freshItems: ok.freshItems,
      samples: ok.samples.slice(0, 3).map(({ title, url, pubDate }) => ({ title, url, pubDate })),
      topicMatch: looksLikeSite(q) ? null : scoreTopicMatch(ok.samples, q),
    };
  });

  // El nombre del feed desempata, pero NO entra en el porcentaje: ese tiene que
  // seguir diciendo de qué hablan las notas, no cómo se llama la publicación.
  const stemsQuery = extractKeywords(q).map(stem);
  const tituloPega = (f: DiscoveredFeed): number =>
    stemsQuery.length > 0 && stemsQuery.every((st) => matchesPrefix(fold(f.title), st)) ? 1 : 0;

  // El idioma se filtra DESPUÉS de validar, con el que declara el feed y no con
  // el que dice el directorio, y un feed que no declara ninguno se conserva:
  // muchos feeds válidos no traen <language> y descartarlos por eso dejaría
  // afuera justo a los chicos, que son los de nicho.
  const enIdioma = (f: DiscoveredFeed): boolean =>
    !lang || !f.language || f.language.toLowerCase().startsWith(lang);

  const feeds = validados
    .filter((f) => f.valid && enIdioma(f))
    .sort(
      (a, b) =>
        (b.topicMatch?.pct ?? -1) - (a.topicMatch?.pct ?? -1) ||
        tituloPega(b) - tituloPega(a) ||
        (b.freshItems ?? 0) - (a.freshItems ?? 0) ||
        (b.subscribers ?? 0) - (a.subscribers ?? 0),
    )
    .slice(0, max);

  return { query: q, feeds, sources, windowDays };
}
