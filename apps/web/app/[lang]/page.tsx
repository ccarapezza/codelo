import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getLatestPosts, type CmsLocale } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { PostBlock } from "@/components/PostBlock";
import { PostListItem } from "@/components/PostListItem";
import { pageMetadata } from "@/lib/seo";

// La home de ESTE proyecto.
//
// Es de las pocas pantallas que el motor NO define: qué va en la portada es la
// decisión editorial más propia que tiene un sitio. Esta es la versión base —
// la nota más reciente destacada y el resto en lista— y está pensada para
// reemplazarse entera, no para configurarse.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "site" });
  return pageMetadata({ lang, path: "", title: t("title"), description: t("description") });
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("home");

  const posts = await getLatestPosts(13, lang as CmsLocale);
  const [destacada, ...resto] = posts;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-16">
      <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{t("latestNews")}</h1>

      {posts.length === 0 ? (
        // Sin CMS cargado —o sin notas publicadas— la home dice qué falta en vez
        // de mostrar una página en blanco.
        <p className="mt-8 text-muted-foreground">{t("noPosts")}</p>
      ) : (
        <>
          <div className="mt-8">
            <PostBlock post={destacada} variant="featured" priority />
          </div>
          {resto.length > 0 ? (
            <ul className="mt-12 divide-y divide-border/60">
              {resto.map(post => (
                <li key={post.slug} className="py-6 first:pt-0">
                  <PostListItem post={post} />
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-12">
            <Link href="/blog" className="label text-sm underline underline-offset-4">
              {t("allNews")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
