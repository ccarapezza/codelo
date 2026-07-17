import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getAllPostSlugs } from "@/lib/cms";
import { SITE_URL, isLocaleIndexable } from "@/lib/seo";

// Locales eligible for the index — the sitemap must not advertise the rest
// (see NOINDEX_LOCALES in lib/seo). Their hreflang alternates are dropped too.
const INDEXABLE_LOCALES = routing.locales.filter(isLocaleIndexable);

// Render at request time, never at build: during `docker compose build` neither
// the CMS host nor Postgres are reachable from the build container, so a
// build-time render would bake an empty list. At runtime both are up.
export const dynamic = "force-dynamic";

// Indexable static routes (without locale prefix).
const STATIC_PATHS = ["", "/quienes-somos", "/reprocann", "/actividades", "/contacto", "/blog"];

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

  return entries;
}
