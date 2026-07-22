import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

export { SITE_URL, SITE_NAME, SITE_LOGO } from "@/lib/site";
import { SITE_URL, SITE_NAME, SITE_LOGO } from "@/lib/site";

export const OG_LOCALE: Record<string, string> = {
  es: "es_AR",
  en: "en_US",
};

/**
 * Locales we deliberately keep OUT of Google's index until they carry original
 * content. Every indexing surface keys off this set: per-page `robots` (via
 * {@link robotsForLocale}), hreflang ({@link localizedAlternates}) and the
 * sitemap. To take a locale out of the index, add it here.
 *
 * EN starts held out while the blog is Spanish-only; empty the set once every
 * published post has an English translation (full ES/EN parity, hreflang-
 * linked).
 */
export const NOINDEX_LOCALES: ReadonlySet<string> = new Set([]);

export function isLocaleIndexable(lang: string): boolean {
  return !NOINDEX_LOCALES.has(lang);
}

/**
 * `robots` metadata for a locale: `noindex, follow` for a non-indexable locale
 * (Google de-indexes the page but still follows its links/hreflang), or
 * `undefined` to inherit the page/site default. Pages that hard-code their own
 * `robots` should fall back to this first: `robotsForLocale(lang) ?? {...}`.
 */
export function robotsForLocale(
  lang: string,
): { index: false; follow: true } | undefined {
  return isLocaleIndexable(lang) ? undefined : { index: false, follow: true };
}

/**
 * Canonical + hreflang alternates for a localized route. `localePrefix` is
 * "always", so every URL carries a locale segment. `path` is the route WITHOUT
 * the locale prefix — e.g. "" (home), "/blog", "/blog/my-post".
 * `metadataBase` (set in the root layout) turns these into absolute URLs.
 *
 * `localePaths` overrides the path per locale for routes whose path differs by
 * language (blog posts have a translated slug). When given, hreflang entries
 * are emitted ONLY for the locales present in it — a missing translation must
 * not advertise a URL that would redirect.
 */
export function localizedAlternates(
  lang: string,
  path = "",
  localePaths?: Partial<Record<string, string>>,
) {
  const clean = path && !path.startsWith("/") ? `/${path}` : path;
  const languages: Record<string, string> = {};
  for (const l of routing.locales) {
    // Never advertise a noindex locale via hreflang — Google should only see
    // alternates that are actually eligible for the index.
    if (!isLocaleIndexable(l)) continue;
    if (localePaths && !(l in localePaths)) continue;
    languages[l] = `/${l}${localePaths?.[l] ?? clean}`;
  }
  const defaultPath = localePaths
    ? localePaths[routing.defaultLocale] ?? localePaths[lang] ?? clean
    : clean;
  languages["x-default"] = `/${routing.defaultLocale}${defaultPath}`;
  return { canonical: `/${lang}${localePaths?.[lang] ?? clean}`, languages };
}

/**
 * Metadata estándar de una página: título, description, canonical/hreflang y
 * las cabeceras de preview al compartir (Open Graph + Twitter card).
 *
 * El bloque `openGraph` existe acá porque Next NO lo mergea campo por campo
 * entre layout y página: si la página define `title` pero no un `openGraph`
 * COMPLETO, hereda el del layout entero — y toda preview compartida muestra el
 * título y la URL de la home (verificado contra el HTML servido). Lo mismo
 * vale para `twitter`. Una página con requisitos extra (p. ej. og:type
 * "article" en las notas) arma su propio bloque en lugar de usar este helper.
 */
export function pageMetadata(o: {
  lang: string;
  /** Ruta SIN el prefijo de locale — igual que en {@link localizedAlternates}. */
  path: string;
  title?: string | null;
  description?: string | null;
}): Metadata {
  const title = o.title ?? undefined;
  const description = o.description ?? undefined;
  // La card por defecto (app/[lang]/opengraph-image.tsx) hay que declararla acá
  // a mano: la inyección automática del file convention vive en el metadata del
  // layout, y este bloque `openGraph` lo reemplaza entero — sin `images`
  // explícito la página queda SIN miniatura (verificado contra el HTML).
  const images = [
    {
      url: `/${o.lang}/opengraph-image`,
      width: 1200,
      height: 630,
      type: "image/png",
      alt: SITE_NAME,
    },
  ];
  return {
    title,
    description,
    alternates: localizedAlternates(o.lang, o.path),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[o.lang] ?? OG_LOCALE[routing.defaultLocale],
      url: `/${o.lang}${o.path}`,
      title,
      description,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

// ---- JSON-LD (schema.org) builders ----

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: SITE_LOGO,
  };
}

export function websiteSchema(lang: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: `${SITE_URL}/${lang}`,
    inLanguage: lang,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function articleSchema(o: {
  title: string;
  description?: string | null;
  lang: string;
  slug: string;
  image?: string | null;
  datePublished?: string | null;
  dateModified?: string | null;
  authorName?: string | null;
}) {
  const url = `${SITE_URL}/${o.lang}/blog/${o.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: o.title,
    description: o.description ?? undefined,
    inLanguage: o.lang,
    url,
    mainEntityOfPage: url,
    image: o.image ? [o.image] : undefined,
    datePublished: o.datePublished ?? undefined,
    dateModified: o.dateModified ?? o.datePublished ?? undefined,
    author: o.authorName
      ? { "@type": "Person", name: o.authorName }
      : { "@type": "Organization", name: SITE_NAME },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      logo: { "@type": "ImageObject", url: SITE_LOGO },
    },
  };
}

/**
 * schema.org Event para la agenda. Son eventos de TERCEROS (ver CLAUDE.md):
 * `organizer` sale del campo del CMS y NUNCA se rellena con la asociación —
 * omitir la atribución equivaldría a atribuirnos el evento también ante Google.
 */
export function eventSchema(o: {
  title: string;
  description?: string | null;
  lang: string;
  startsAt: string;
  endsAt?: string | null;
  place?: string | null;
  organizer?: string | null;
  sourceUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: o.title,
    description: o.description ?? undefined,
    inLanguage: o.lang,
    startDate: o.startsAt,
    endDate: o.endsAt ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    location: o.place ? { "@type": "Place", name: o.place } : undefined,
    organizer: o.organizer ? { "@type": "Organization", name: o.organizer } : undefined,
    url: o.sourceUrl ?? undefined,
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}
