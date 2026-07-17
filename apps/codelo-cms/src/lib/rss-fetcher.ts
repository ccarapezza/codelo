import type { Core } from "@strapi/strapi";

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

async function fetchFeed(feedUrl: string, source: string, timeoutMs = 8000): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(feedUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "FulboBot/1.0 (RSS aggregator)" },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml, source);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function isWithin24h(item: NewsItem): boolean {
  if (!item.itemPublishedAt) return true;
  return item.itemPublishedAt.getTime() >= Date.now() - 24 * 60 * 60 * 1000;
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
      headers: { "User-Agent": "FulboBot/1.0 (RSS aggregator)" },
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

  const freshItems = items.filter(isWithin24h).length;
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

  const allItems: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const fresh = r.value.filter(isWithin24h);
      strapi.log.info(`[rss-fetcher] ${feeds[i].name}: ${fresh.length} items (last 24h)`);
      allItems.push(...fresh);
    } else {
      strapi.log.warn(`[rss-fetcher] ${feeds[i].name} failed:`, r.reason);
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

  // Update lastFetchedAt on each feed
  const now = new Date().toISOString();
  for (const feed of feeds) {
    await strapi
      .documents("api::rss-feed.rss-feed")
      .update({ documentId: feed.documentId, data: { lastFetchedAt: now } });
  }

  await pruneOldNews(strapi);
  strapi.log.info("[rss-fetcher] RSS fetch cycle complete.");
}

// Hardcoded keyword set that flags items as relevant to the 2026 World Cup.
// Multi-language so feeds in EN/ES/PT all surface relevant articles.
// Most RSS feeds we ingest are generic football (club leagues); this filter
// is what stops the redactor from picking up Real Madrid or Premier League
// stories when its job is to cover the World Cup.
const MUNDIAL_KEYWORDS = [
  "mundial",
  "world cup",
  "copa del mundo",
  "selección",
  "seleccion",
  "seleção",
  "selecao",
  "national team",
  "eliminator", // eliminator, eliminatoria, eliminatorio
  "qualifier",
  "fifa world",
  "wc 2026",
  "wc2026",
  "wc-2026",
];

export function isMundialRelevant(item: { title: string; summary: string }): boolean {
  const haystack = `${item.title} ${item.summary ?? ""}`.toLowerCase();
  return MUNDIAL_KEYWORDS.some((kw) => haystack.includes(kw));
}

export async function getRecentNewsForTopic(
  strapi: Core.Strapi,
  topic: string,
  limit = 10,
): Promise<NewsItem[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const all = (await strapi.documents("api::news-context.news-context").findMany({
    filters: { fetchedAt: { $gte: since.toISOString() } },
    sort: { itemPublishedAt: "desc" },
    limit: 200,
  })) as unknown as Array<{
    title: string;
    url: string;
    source: string;
    summary: string;
    itemPublishedAt: string | null;
    fetchedAt: string;
  }>;

  if (all.length === 0) return [];

  const keywords = topic
    .toLowerCase()
    .split(/[\s,;.]+/)
    .filter((w) => w.length > 3);

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
