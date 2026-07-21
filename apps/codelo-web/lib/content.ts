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
  /** Quién organiza. La asociación agenda estos eventos, no los organiza. */
  organizer: string | null;
  /** Sitio oficial del evento, para verificar en la fuente. */
  sourceUrl: string | null;
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
  organizer?: string | null;
  sourceUrl?: string | null;
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
      organizer: e.organizer ?? null,
      sourceUrl: e.sourceUrl ?? null,
      description: e.description ?? null,
      coverImageUrl: proxiedUrl(e.coverImage?.url),
    }));
  } catch {
    return [];
  }
}

/** Ítem del riel normativo: una norma del Boletín Oficial ya ingerida. */
export type BoletinEntry = {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  /** Extracto legible de la norma. Puede ser null si no se pudo aislar. */
  excerpt: string | null;
};

/**
 * Saca un extracto legible del texto de una norma.
 *
 * El cuerpo guardado es el texto íntegro y abre con la fórmula de estilo:
 * "Ciudad de Buenos Aires, 26/06/2026 VISTO el Expediente EX-2026-…, las Leyes
 * Nros. 20.247, 25.845…". Eso dice de qué expediente viene, no de qué se
 * trata: como descripción no sirve. La sustancia arranca después del
 * CONSIDERANDO, en el primer "Que …", que es donde la norma explica su motivo.
 */
function boletinExcerpt(summary: string | null | undefined, max = 190): string | null {
  if (!summary) return null;
  let text = summary.trim();

  const considerando = text.search(/CONSIDERANDO\s*:?/i);
  if (considerando !== -1) {
    text = text.slice(considerando).replace(/^CONSIDERANDO\s*:?\s*/i, "");
  } else {
    // Sin CONSIDERANDO (los avisos oficiales no lo tienen) se descarta solo el
    // encabezado de ciudad y fecha, que tampoco aporta.
    text = text.replace(/^Ciudad de [^,]+,\s*\d{2}\/\d{2}\/\d{4}\s*/i, "");
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text || null;

  // Cortar en el último límite de palabra para no partir a la mitad.
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}…`;
}

/**
 * Últimas normas relevadas del Boletín Oficial.
 *
 * Lee `news-context` (público) filtrando por las entradas que cargó el
 * vigilante normativo del CMS. Es el material del riel lateral de la home: a
 * diferencia de un "últimas noticias" genérico, muestra cambios regulatorios
 * en su fuente primaria, que es lo que un lector de esta asociación necesita.
 */
export async function getBoletinEntries(limit = 6): Promise<BoletinEntry[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/news-contexts`);
  url.searchParams.set("filters[source][$startsWith]", "Boletín Oficial");
  url.searchParams.set("fields[0]", "title");
  url.searchParams.set("fields[1]", "url");
  url.searchParams.set("fields[2]", "source");
  url.searchParams.set("fields[3]", "itemPublishedAt");
  url.searchParams.set("fields[4]", "summary");
  url.searchParams.set("sort", "itemPublishedAt:desc");
  url.searchParams.set("pagination[pageSize]", String(limit));

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!response.ok) return [];
    const json = (await response.json()) as {
      data: Array<{
        title: string;
        url: string;
        source: string;
        itemPublishedAt: string | null;
        summary: string | null;
      }>;
    };
    return (json.data ?? []).map(item => ({
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: item.itemPublishedAt,
      excerpt: boletinExcerpt(item.summary),
    }));
  } catch {
    return [];
  }
}
