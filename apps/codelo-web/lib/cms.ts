import { markdownToPlainText } from "./markdown";

export type CmsLocale = "es" | "en";

export type CmsTag = {
  name: string;
  slug: string;
  kind: "topic" | "event";
  reference?: string | null;
};

export type CmsImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string | null;
  formats?: {
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
  };
};

export type CmsPostListItem = {
  id: number;
  documentId: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  tags: CmsTag[];
  coverImage?: CmsImage | null;
  authorName?: string | null;
};

export type CmsPostDetail = CmsPostListItem & {
  content?: string | null;
  /** Slug of this post in each locale where a published version exists. */
  alternates: Partial<Record<CmsLocale, string>>;
};

export type CmsSiteSettings = {
  adsensePublisherId: string | null;
  adsenseSidebarLeftSlot: string | null;
  adsenseSidebarRightSlot: string | null;
  adsenseHomeInFeedSlot: string | null;
  adsenseMobileBannerSlot: string | null;
  adsenseInArticleSlot: string | null;
  googleAnalyticsId: string | null;
  googleSiteVerification: string | null;
  clarityProjectId: string | null;
  houseAdsEnabled: boolean;
};

export type CmsHouseAdSlot =
  | "mobileBanner"
  | "homeInFeed"
  | "inArticle"
  | "sidebarLeft"
  | "sidebarRight";

export type CmsHouseAd = {
  id: number;
  slot: CmsHouseAdSlot;
  image: CmsImage;
  alt: string;
  href: string;
  weight: number;
  label?: string | null;
};

type StrapiImageFormat = { url: string; width?: number; height?: number };
type StrapiImage = {
  url: string;
  width?: number;
  height?: number;
  alternativeText?: string | null;
  formats?: {
    thumbnail?: StrapiImageFormat;
    small?: StrapiImageFormat;
    medium?: StrapiImageFormat;
    large?: StrapiImageFormat;
  };
};

// Strapi 5 REST returns flat entities (no `attributes` wrapper).
type StrapiPost = {
  id: number;
  documentId?: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  content?: string | null;
  publishedAt?: string | null;
  authorName?: string | null;
  tags?: Array<{
    id: number;
    documentId?: string;
    name: string;
    slug: string;
    kind: "topic" | "event";
    reference?: string | null;
  }>;
  coverImage?: StrapiImage | null;
  locale?: string;
};

type StrapiSingle<T> = { data: T | null };
type StrapiSiteSetting = {
  adsensePublisherId?: string | null;
  adsenseSidebarLeftSlot?: string | null;
  adsenseSidebarRightSlot?: string | null;
  adsenseHomeInFeedSlot?: string | null;
  adsenseMobileBannerSlot?: string | null;
  adsenseInArticleSlot?: string | null;
  googleAnalyticsId?: string | null;
  googleSiteVerification?: string | null;
  clarityProjectId?: string | null;
  houseAdsEnabled?: boolean | null;
};

type StrapiHouseAd = {
  id: number;
  slot: CmsHouseAdSlot;
  image: StrapiImage | null;
  alt: string;
  href: string;
  weight?: number | null;
  enabled?: boolean | null;
  label?: string | null;
};

type StrapiCollection<T> = { data: T[] };

const getCmsBaseUrl = () => {
  const raw = process.env.NEXT_PUBLIC_CMS_URL ?? "";
  return raw.replace(/\/$/, "");
};

// Image URLs end up in the browser, so we route them through the Next.js host
// via the `/cms/*` rewrite (next.config.ts). This way clients only ever hit the
// public origin — important when accessing the site through a tunnel or under
// a single domain. API URLs still use the full base for server-side fetches.
const proxiedUrl = (path: string): string =>
  path.startsWith("http://") || path.startsWith("https://") ? path : `/cms${path}`;

const mapTags = (post: StrapiPost): CmsTag[] =>
  (post.tags ?? []).map((t) => ({
    name: t.name,
    slug: t.slug,
    kind: t.kind,
    reference: t.reference ?? null,
  }));

const mapImage = (img: StrapiImage | null | undefined): CmsImage | null => {
  if (!img?.url) return null;
  const formats = img.formats
    ? {
        thumbnail: img.formats.thumbnail ? proxiedUrl(img.formats.thumbnail.url) : undefined,
        small: img.formats.small ? proxiedUrl(img.formats.small.url) : undefined,
        medium: img.formats.medium ? proxiedUrl(img.formats.medium.url) : undefined,
        large: img.formats.large ? proxiedUrl(img.formats.large.url) : undefined,
      }
    : undefined;
  return {
    url: proxiedUrl(img.url),
    width: img.width,
    height: img.height,
    alt: img.alternativeText ?? null,
    formats,
  };
};

const mapCoverImage = (post: StrapiPost): CmsImage | null => mapImage(post.coverImage);

const toListItem = (p: StrapiPost): CmsPostListItem => ({
  id: p.id,
  documentId: p.documentId ?? null,
  // Titles are rendered as plain text (H1, <title>, cards). The LLM sometimes
  // leaks body markdown into the title (e.g. `**England** ganó…`); flatten so
  // the raw **/_/`/# marks never show. Same treatment as the excerpt below.
  title: markdownToPlainText(p.title),
  slug: p.slug,
  // Excerpts can carry markdown from the CMS/LLM; flatten so cards, lists and
  // SEO descriptions show clean text instead of raw **/_/`/# marks.
  excerpt: p.excerpt ? markdownToPlainText(p.excerpt) : null,
  publishedAt: p.publishedAt ?? null,
  tags: mapTags(p),
  coverImage: mapCoverImage(p),
  authorName: p.authorName ?? null,
});

/** One sitemap entry per documentId, with the slug of every locale that has a
 *  published version. Spanish is the source language, so it's always present. */
export type CmsPostSlugEntry = {
  locales: Partial<Record<CmsLocale, { slug: string; updatedAt: string | null }>>;
};

// Strapi marks the auto-generated `localizations` attribute as private, so the
// REST sanitizer strips it from responses. Translations are linked by sharing
// the documentId across locales — so the alternate-locale slug is resolved
// with a second query filtered by documentId.
const fetchSlugList = async (
  locale: CmsLocale,
): Promise<Array<{ documentId: string; slug: string; updatedAt: string | null }>> => {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/posts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fields[0]", "slug");
  url.searchParams.set("fields[1]", "updatedAt");
  url.searchParams.set("fields[2]", "publishedAt");
  url.searchParams.set("sort", "publishedAt:desc");
  url.searchParams.set("pagination[pageSize]", "1000");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const json = (await response.json()) as StrapiCollection<
      StrapiPost & { updatedAt?: string | null }
    >;
    return (json.data ?? [])
      .filter((p) => Boolean(p.slug) && Boolean(p.documentId))
      .map((p) => ({
        documentId: p.documentId!,
        slug: p.slug,
        updatedAt: p.updatedAt ?? p.publishedAt ?? null,
      }));
  } catch {
    return [];
  }
};

export async function getAllPostSlugs(): Promise<CmsPostSlugEntry[]> {
  const [es, en] = await Promise.all([fetchSlugList("es"), fetchSlugList("en")]);
  const enByDoc = new Map(en.map((p) => [p.documentId, p]));
  return es.map((p) => {
    const locales: CmsPostSlugEntry["locales"] = {
      es: { slug: p.slug, updatedAt: p.updatedAt },
    };
    const enEntry = enByDoc.get(p.documentId);
    if (enEntry) locales.en = { slug: enEntry.slug, updatedAt: enEntry.updatedAt };
    return { locales };
  });
}

export async function getLatestPosts(limit: number, locale: CmsLocale): Promise<CmsPostListItem[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/posts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("populate[0]", "tags");
  url.searchParams.set("populate[1]", "coverImage");
  url.searchParams.set("sort", "publishedAt:desc");
  url.searchParams.set("pagination[pageSize]", String(limit));

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];

    const json = (await response.json()) as StrapiCollection<StrapiPost>;
    return (json.data ?? []).map((p) => toListItem(p));
  } catch {
    return [];
  }
}

export async function getPostsByTagSlug(
  tagSlug: string,
  limit: number,
  locale: CmsLocale,
): Promise<CmsPostListItem[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/posts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("populate[0]", "tags");
  url.searchParams.set("populate[1]", "coverImage");
  url.searchParams.set("filters[tags][slug][$eq]", tagSlug);
  url.searchParams.set("sort", "publishedAt:desc");
  url.searchParams.set("pagination[pageSize]", String(limit));

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const json = (await response.json()) as StrapiCollection<StrapiPost>;
    return (json.data ?? []).map((p) => toListItem(p));
  } catch {
    return [];
  }
}

export async function getSiteSettings(): Promise<CmsSiteSettings> {
  const empty: CmsSiteSettings = {
    adsensePublisherId: null,
    adsenseSidebarLeftSlot: null,
    adsenseSidebarRightSlot: null,
    adsenseHomeInFeedSlot: null,
    adsenseMobileBannerSlot: null,
    adsenseInArticleSlot: null,
    googleAnalyticsId: null,
    googleSiteVerification: null,
    clarityProjectId: null,
    houseAdsEnabled: false,
  };

  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return empty;

  try {
    const response = await fetch(`${baseUrl}/api/site-setting`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return empty;

    const json = (await response.json()) as StrapiSingle<StrapiSiteSetting>;
    const data = json.data;
    if (!data) return empty;

    return {
      adsensePublisherId: data.adsensePublisherId ?? null,
      adsenseSidebarLeftSlot: data.adsenseSidebarLeftSlot ?? null,
      adsenseSidebarRightSlot: data.adsenseSidebarRightSlot ?? null,
      adsenseHomeInFeedSlot: data.adsenseHomeInFeedSlot ?? null,
      adsenseMobileBannerSlot: data.adsenseMobileBannerSlot ?? null,
      adsenseInArticleSlot: data.adsenseInArticleSlot ?? null,
      googleAnalyticsId: data.googleAnalyticsId ?? null,
      googleSiteVerification: data.googleSiteVerification ?? null,
      clarityProjectId: data.clarityProjectId ?? null,
      houseAdsEnabled: Boolean(data.houseAdsEnabled),
    };
  } catch {
    return empty;
  }
}

/**
 * Fetch every enabled house ad from Strapi (grouped later by slot in
 * `lib/houseAds.ts`). Strapi returns the public collection at
 * `/api/house-ads` with image populated.
 */
export async function getHouseAds(): Promise<CmsHouseAd[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  try {
    const url = new URL(`${baseUrl}/api/house-ads`);
    url.searchParams.set("filters[enabled][$eq]", "true");
    url.searchParams.set("populate", "image");
    url.searchParams.set("pagination[pageSize]", "100");
    const response = await fetch(url.toString(), {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];

    const json = (await response.json()) as StrapiCollection<StrapiHouseAd>;
    const items = json.data ?? [];
    const mapped: (CmsHouseAd | null)[] = items.map((item) => {
      const image = mapImage(item.image);
      if (!image || !item.alt || !item.href) return null;
      return {
        id: item.id,
        slot: item.slot,
        image,
        alt: item.alt,
        href: item.href,
        weight: Math.max(0, item.weight ?? 1),
        label: item.label ?? null,
      };
    });
    return mapped.filter((x): x is CmsHouseAd => x !== null);
  } catch {
    return [];
  }
}

const fetchPostBySlug = async (slug: string, locale: CmsLocale): Promise<StrapiPost | null> => {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(`${baseUrl}/api/posts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("populate[0]", "tags");
  url.searchParams.set("populate[1]", "coverImage");
  url.searchParams.set("filters[slug][$eq]", slug);
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;

    const json = (await response.json()) as StrapiCollection<StrapiPost>;
    return json.data?.[0] ?? null;
  } catch {
    return null;
  }
};

/** Slug of this document's published version in `locale`, or null. Localized
 *  versions share the documentId, so this is how translations are linked. */
const fetchSlugByDocumentId = async (
  documentId: string,
  locale: CmsLocale,
): Promise<string | null> => {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(`${baseUrl}/api/posts`);
  url.searchParams.set("locale", locale);
  url.searchParams.set("fields[0]", "slug");
  url.searchParams.set("filters[documentId][$eq]", documentId);
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!response.ok) return null;
    const json = (await response.json()) as StrapiCollection<StrapiPost>;
    return json.data?.[0]?.slug ?? null;
  } catch {
    return null;
  }
};

export async function getPostBySlug(slug: string, locale: CmsLocale): Promise<CmsPostDetail | null> {
  const post = await fetchPostBySlug(slug, locale);
  if (!post) return null;

  const alternates: CmsPostDetail["alternates"] = { [locale]: post.slug };
  const other: CmsLocale = locale === "es" ? "en" : "es";
  if (post.documentId) {
    const otherSlug = await fetchSlugByDocumentId(post.documentId, other);
    if (otherSlug) alternates[other] = otherSlug;
  }

  return {
    ...toListItem(post),
    content: post.content ?? null,
    alternates,
  };
}

/**
 * Fallback for slugs that don't exist in the requested locale (e.g. an old
 * shared link `/en/blog/<spanish-slug>`). Looks the slug up in the other
 * locale; if found, returns where the visitor should be redirected: the
 * translated slug in the requested locale when a translation exists, or the
 * other locale's URL when it doesn't.
 */
export async function resolvePostRedirect(
  slug: string,
  locale: CmsLocale,
): Promise<{ locale: CmsLocale; slug: string } | null> {
  const other: CmsLocale = locale === "es" ? "en" : "es";
  const post = await fetchPostBySlug(slug, other);
  if (!post) return null;
  const translatedSlug = post.documentId
    ? await fetchSlugByDocumentId(post.documentId, locale)
    : null;
  if (translatedSlug) return { locale, slug: translatedSlug };
  return { locale: other, slug: post.slug };
}
