import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { CmsPageView } from "@/components/CmsPageView";
import { getPageBySlug } from "@/lib/content";
import { localizedAlternates } from "@/lib/seo";

const SLUG = "reprocann";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const page = await getPageBySlug(SLUG);
  return {
    title: page?.title ?? "REPROCANN y marco legal",
    description: page?.seoDescription ?? undefined,
    alternates: localizedAlternates(lang, `/${SLUG}`),
  };
}

export default async function ReprocannPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const page = await getPageBySlug(SLUG);
  return <CmsPageView page={page} />;
}
