import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { getPostsByTagSlug, getLatestPosts } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { PostCover } from "@/components/PostCover";
import { PostCoverFallback } from "@/components/PostCoverFallback";
import { formatShortDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

// El nombre de la etiqueta no vive en una tabla propia accesible por slug desde
// la web: se resuelve desde las notas que la llevan. Con una sola llamada
// alcanza, porque getPostsByTagSlug ya popula `tags`.
async function resolveTagName(slug: string, locale: Locale): Promise<string | null> {
  const posts = await getPostsByTagSlug(slug, 1, locale);
  return posts[0]?.tags.find(t => t.slug === slug)?.name ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const [name, t, tHome] = await Promise.all([
    resolveTagName(slug, lang as Locale),
    getTranslations({ locale: lang, namespace: "tags" }),
    getTranslations({ locale: lang, namespace: "home" }),
  ]);
  // La bajada editorial de la sección (beatNotes) es la mejor description
  // posible; para etiquetas sin bajada declarada hay un genérico con el nombre.
  const notes = tHome.raw("beatNotes") as Record<string, string>;
  return pageMetadata({
    lang,
    path: `/etiqueta/${slug}`,
    title: name,
    description: notes[slug] ?? (name ? t("seoDescription", { name }) : undefined),
  });
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("tags");
  const tHome = await getTranslations("home");

  const posts = await getPostsByTagSlug(slug, 40, locale);
  // Una etiqueta sin notas no es una página vacía: es una URL que no existe.
  if (posts.length === 0) notFound();

  const name = posts[0]?.tags.find(tg => tg.slug === slug)?.name ?? slug;
  const notes = tHome.raw("beatNotes") as Record<string, string>;
  const note = notes[slug] ?? null;
  const [lead, ...rest] = posts;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {name}
        </h1>
        {note ? (
          <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
            {note}
          </p>
        ) : null}
        <p className="label mt-4 text-muted-foreground">
          {t("count", { count: posts.length })}
        </p>
      </header>

      <article className="border-t border-rule pt-8">
        <Link
          href={`/blog/${lead.slug}`}
          className="group grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]"
        >
          <div className="duotone relative aspect-[16/9] overflow-hidden">
            {lead.coverImage ? (
              <PostCover
                image={lead.coverImage}
                alt={lead.title}
                format="large"
                priority
                sizes="(min-width: 1024px) 860px, 100vw"
                className="h-full w-full object-cover"
              />
            ) : (
              <PostCoverFallback title={lead.title} seed={lead.slug} />
            )}
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.02] font-semibold tracking-tight text-balance group-hover:text-ember">
              {lead.title}
            </h2>
            {lead.excerpt ? (
              <p className="mt-4 font-serif leading-relaxed text-muted-foreground">
                {lead.excerpt}
              </p>
            ) : null}
            {lead.publishedAt ? (
              <p className="label mt-5 text-muted-foreground">
                {formatShortDate(lead.publishedAt, locale)}
              </p>
            ) : null}
          </div>
        </Link>
      </article>

      {rest.length > 0 ? (
        <ul className="mt-12 border-t border-rule">
          {rest.map(post => (
            <li key={post.slug} className="border-b border-rule">
              <Link
                href={`/blog/${post.slug}`}
                className="group grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[7rem_minmax(0,1fr)]"
              >
                <p className="label text-muted-foreground">
                  {post.publishedAt ? formatShortDate(post.publishedAt, locale) : ""}
                </p>
                <div>
                  <h3 className="font-semibold leading-snug group-hover:text-ember">
                    {post.title}
                  </h3>
                  {post.excerpt ? (
                    <p className="mt-1 font-serif text-sm leading-snug text-muted-foreground">
                      {post.excerpt}
                    </p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <Link href="/blog" className="label mt-10 inline-block text-ember hover:underline">
        {t("backToBlog")} →
      </Link>
    </main>
  );
}
