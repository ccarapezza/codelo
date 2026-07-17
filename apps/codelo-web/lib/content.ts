// Fetchers for the CMS-managed static pages and events. Same conventions as
// lib/cms.ts: server-side fetch against NEXT_PUBLIC_CMS_URL, fail-soft (null /
// empty list) when the CMS is unreachable, media proxied through /cms/*.

export type CmsPage = {
  title: string;
  slug: string;
  content: string;
  seoDescription: string | null;
  coverImageUrl: string | null;
  updatedAt: string | null;
};

export type CmsEvent = {
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  description: string | null;
  coverImageUrl: string | null;
};

type StrapiMedia = { url?: string | null } | null | undefined;

type StrapiPage = {
  title: string;
  slug: string;
  content: string;
  seoDescription?: string | null;
  coverImage?: StrapiMedia;
  updatedAt?: string | null;
};

type StrapiEvent = {
  title: string;
  slug: string;
  startsAt: string;
  endsAt?: string | null;
  place?: string | null;
  description?: string | null;
  coverImage?: StrapiMedia;
};

type StrapiCollection<T> = { data: T[] };

const getCmsBaseUrl = () => (process.env.NEXT_PUBLIC_CMS_URL ?? "").replace(/\/$/, "");

const proxiedUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  return path.startsWith("http://") || path.startsWith("https://") ? path : `/cms${path}`;
};

export async function getPageBySlug(slug: string): Promise<CmsPage | null> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return null;

  const url = new URL(`${baseUrl}/api/pages`);
  url.searchParams.set("filters[slug][$eq]", slug);
  url.searchParams.set("populate", "coverImage");
  url.searchParams.set("pagination[pageSize]", "1");

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!response.ok) return null;
    const json = (await response.json()) as StrapiCollection<StrapiPage>;
    const page = json.data[0];
    if (!page) return null;
    return {
      title: page.title,
      slug: page.slug,
      content: page.content,
      seoDescription: page.seoDescription ?? null,
      coverImageUrl: proxiedUrl(page.coverImage?.url),
      updatedAt: page.updatedAt ?? null,
    };
  } catch {
    return null;
  }
}

export async function getEvents(opts?: {
  upcomingOnly?: boolean;
  limit?: number;
}): Promise<CmsEvent[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/events`);
  url.searchParams.set("populate", "coverImage");
  url.searchParams.set("pagination[pageSize]", String(opts?.limit ?? 50));
  if (opts?.upcomingOnly) {
    url.searchParams.set("filters[startsAt][$gte]", new Date().toISOString());
    url.searchParams.set("sort", "startsAt:asc");
  } else {
    url.searchParams.set("sort", "startsAt:desc");
  }

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const json = (await response.json()) as StrapiCollection<StrapiEvent>;
    return json.data.map(e => ({
      title: e.title,
      slug: e.slug,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      place: e.place ?? null,
      description: e.description ?? null,
      coverImageUrl: proxiedUrl(e.coverImage?.url),
    }));
  } catch {
    return [];
  }
}
