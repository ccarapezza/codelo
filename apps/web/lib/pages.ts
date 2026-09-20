// Páginas estáticas del CMS, servidas por slug.
//
// Del MOTOR: cualquier portal tiene páginas así, y la ruta genérica
// app/[lang]/[slug] las publica sin que haga falta escribir código. Lo
// específico de este sitio —agenda, normas— vive en lib/vertical/content.ts.

import { getCmsBaseUrl, proxiedUrl, type StrapiCollection, type StrapiPage } from "./cms-fetch";

export type CmsPage = {
  title: string;
  slug: string;
  content: string;
  seoDescription: string | null;
  coverImageUrl: string | null;
  updatedAt: string | null;
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
