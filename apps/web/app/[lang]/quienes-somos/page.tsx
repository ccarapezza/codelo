import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { QuienesSomosView } from "@/components/QuienesSomosView";
import { getPageBySlug } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

const SLUG = "quienes-somos";

// La metadata sigue saliendo de la page del CMS (título/SEO editables desde el
// admin); el CUERPO ya no: lo renderiza QuienesSomosView, la maqueta
// infográfica propia. El markdown de docs/contenido/quienes-somos.md queda
// como fuente textual de referencia.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const page = await getPageBySlug(SLUG);
  return pageMetadata({
    lang,
    path: `/${SLUG}`,
    title: page?.title ?? "Quiénes somos",
    description: page?.seoDescription,
  });
}

export default async function QuienesSomosPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  return <QuienesSomosView />;
}
