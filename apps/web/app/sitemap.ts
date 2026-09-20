import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllPostSlugs, getLatestPosts, type CmsLocale } from "@/lib/cms";
import { VERTICAL_STATIC_PATHS, extraSitemapPaths } from "@/lib/vertical/sitemap";
import { SITE_URL, isLocaleIndexable } from "@/lib/seo";

// Locales eligible for the index — the sitemap must not advertise the rest
// (see NOINDEX_LOCALES in lib/seo). Their hreflang alternates are dropped too.
const INDEXABLE_LOCALES = routing.locales.filter(isLocaleIndexable);

// Render at request time, never at build: during `docker compose build` neither
// the CMS host nor Postgres are reachable from the build container, so a
// build-time render would bake an empty list. At runtime both are up.
export const dynamic = "force-dynamic";

// Rutas estáticas indexables (sin el prefijo de idioma). Las del motor, más
// las que declare el proyecto (lib/vertical/sitemap.ts).
const STATIC_PATHS = ["", "/blog", ...VERTICAL_STATIC_PATHS];

function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const l of INDEXABLE_LOCALES) languages[l] = `${SITE_URL}/${l}${path}`;
  return languages;
}

function entriesForPath(
  path: string,
  lastModified: Date,
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
  priority: number,
): MetadataRoute.Sitemap {
  const languages = languageAlternates(path);
  return INDEXABLE_LOCALES.map(l => ({
    url: `${SITE_URL}/${l}${path}`,
    lastModified,
    changeFrequency,
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of STATIC_PATHS) {
    entries.push(
      ...entriesForPath(path, now, path === "" ? "daily" : "weekly", path === "" ? 1 : 0.7),
    );
  }

  // Blog posts — per-locale slugs from the CMS (translated slugs differ).
  try {
    const posts = await getAllPostSlugs();
    for (const post of posts) {
      const languages: Record<string, string> = {};
      for (const l of INDEXABLE_LOCALES) {
        const entry = post.locales[l as keyof typeof post.locales];
        if (entry) languages[l] = `${SITE_URL}/${l}/blog/${entry.slug}`;
      }
      for (const l of INDEXABLE_LOCALES) {
        const entry = post.locales[l as keyof typeof post.locales];
        if (!entry) continue;
        entries.push({
          url: `${SITE_URL}/${l}/blog/${entry.slug}`,
          lastModified: entry.updatedAt ? new Date(entry.updatedAt) : now,
          changeFrequency: "monthly",
          priority: 0.6,
          alternates: { languages },
        });
      }
    }
  } catch {
    // CMS down — serve the static portion rather than failing the sitemap.
  }

  // Tag pages (/etiqueta/<slug>). There is no tag-list endpoint on the web
  // side, and a tag with zero posts 404s — so the slugs are derived from the
  // posts themselves: only tags that actually resolve to a page get listed.
  try {
    for (const l of INDEXABLE_LOCALES) {
      const posts = await getLatestPosts(200, l as CmsLocale);
      const tagSlugs = new Set<string>();
      for (const post of posts) for (const tag of post.tags) tagSlugs.add(tag.slug);
      for (const slug of tagSlugs) {
        entries.push({
          url: `${SITE_URL}/${l}/etiqueta/${slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }
  } catch {
    // Same fail-soft as posts.
  }

  // Páginas dinámicas propias del proyecto, si las hay: fichas de un espejo,
  // catálogos, lo que sea. El motor no sabe qué son, sólo las agrega.
  try {
    for (const path of await extraSitemapPaths()) {
      entries.push(...entriesForPath(path, now, "monthly", 0.4));
    }
  } catch {
    // Mismo criterio que arriba: si la fuente no responde, se omiten.
  }

  return entries;
}
