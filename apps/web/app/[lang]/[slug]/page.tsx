import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/CmsPageView";
import { getPageBySlug } from "@/lib/pages";
import { pageMetadata } from "@/lib/seo";
import { isDeclaredPath } from "@/lib/site";

// Cualquier página cargada en el CMS, servida por su slug. Es lo que permite
// publicar una página nueva sin tocar código.
//
// Las rutas con segmento fijo —/blog, /etiqueta/..., y las propias del
// proyecto— le ganan a esta: Next resuelve primero lo estático. Así que esto
// sólo atiende lo que no matcheó antes, y un slug que no existe en el CMS
// termina en 404, igual que cualquier URL inventada.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const page = await getPageBySlug(slug);
  if (!page) return {};
  return pageMetadata({
    lang,
    path: `/${slug}`,
    title: page.title,
    description: page.seoDescription,
  });
}

export default async function CmsSlugPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  setRequestLocale(lang);

  const page = await getPageBySlug(slug);

  // Una ruta que el sitio ANUNCIA en su navegación siempre responde, aunque el
  // contenido todavía no esté cargado: muestra el placeholder de "sin
  // contenido" en vez de un 404. Un enlace del menú que da 404 parece el sitio
  // roto; el placeholder dice la verdad, que falta cargar la página.
  //
  // Lo que nadie anunció y no existe en el CMS sí es un 404, que es lo correcto
  // para una URL inventada.
  if (!page && !isDeclaredPath(`/${slug}`)) notFound();

  const t = await getTranslations({ locale: lang, namespace: "pages" });
  return <CmsPageView page={page} eyebrow={t("eyebrow")} decoration={slug} />;
}
