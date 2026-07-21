import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/CmsPageView";
import { getPageBySlug } from "@/lib/content";
import { localizedAlternates } from "@/lib/seo";

const SLUG = "contacto";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const page = await getPageBySlug(SLUG);
  return {
    title: page?.title ?? "Contacto y cómo sumarse",
    description: page?.seoDescription ?? undefined,
    alternates: localizedAlternates(lang, `/${SLUG}`),
  };
}

async function pageEyebrow(lang: string) {
  const t = await getTranslations({ locale: lang, namespace: "pages" });
  return t("eyebrowContact");
}

export default async function ContactoPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const page = await getPageBySlug(SLUG);
  return <CmsPageView page={page} eyebrow={await pageEyebrow(lang)} />;
}
