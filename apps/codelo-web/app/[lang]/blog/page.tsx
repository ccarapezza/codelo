import { getLocale, getTranslations } from "next-intl/server";
import { getLatestPosts, type CmsPostListItem, type CmsTag } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { PostCover } from "@/components/PostCover";
import { PostCoverFallback } from "@/components/PostCoverFallback";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  return pageMetadata({ lang, path: "/blog", title: t("title"), description: t("tagline") });
}

function tagChipClass(tag: CmsTag): string {
  return cn(
    "label inline-flex w-fit items-center border px-2 py-1 transition-colors",
    tag.kind === "event"
      ? "border-ember/50 text-ember"
      : "border-rule text-muted-foreground",
  );
}

/** Portada impresa en las dos tintas (ver .duotone en globals.css). */
function Cover({
  post,
  format,
  sizes,
  priority,
  className,
}: {
  post: CmsPostListItem;
  format: "large" | "small";
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("duotone relative overflow-hidden", className)}>
      {post.coverImage ? (
        <PostCover
          image={post.coverImage}
          alt={post.title}
          format={format}
          priority={priority}
          sizes={sizes}
          className="h-full w-full object-cover"
        />
      ) : (
        <PostCoverFallback title={post.title} seed={post.slug} />
      )}
    </div>
  );
}

export default async function BlogIndexPage() {
  const locale = (await getLocale()) as Locale;
  const posts = await getLatestPosts(30, locale);
  const [featured, ...rest] = posts;
  const t = await getTranslations("blog");
  const formatDate = (iso: string) => formatShortDate(iso, locale);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          {t("tagline")}
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="border-t border-rule py-16 text-center font-serif text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <>
          {/* Destacada: la portada manda, como en la tapa. */}
          {featured ? (
            <article className="border-t border-rule pt-8">
              <Link href={`/blog/${featured.slug}`} className="group grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Cover
                  post={featured}
                  format="large"
                  sizes="(min-width: 1024px) 860px, 100vw"
                  priority
                  className="aspect-[16/9]"
                />
                <div className="flex flex-col justify-center">
                  <p className="label text-ember">{t("featured")}</p>
                  <h2 className="mt-3 text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.02] font-semibold tracking-tight text-balance group-hover:text-ember">
                    {featured.title}
                  </h2>
                  {featured.excerpt ? (
                    <p className="mt-4 font-serif leading-relaxed text-muted-foreground">
                      {featured.excerpt}
                    </p>
                  ) : null}
                  <p className="label mt-5 text-muted-foreground">
                    {featured.authorName ? `${featured.authorName} · ` : ""}
                    {featured.publishedAt ? formatDate(featured.publishedAt) : ""}
                  </p>
                </div>
              </Link>
            </article>
          ) : null}

          {/* Río de notas: lista densa separada por filetes, sin tarjetas.
              La fecha va a la izquierda en mono para que la columna se pueda
              barrer con la vista como un índice. */}
          {rest.length > 0 ? (
            <section className="mt-16">
              <h2 className="section-rule label pt-3 pb-4 text-ink">{t("moreNotes")}</h2>
              <ul>
                {rest.map(post => {
                  const topicTag = post.tags.find(tag => tag.kind === "topic") ?? post.tags[0];
                  return (
                    <li key={post.id} className="border-b border-rule">
                      <Link
                        href={`/blog/${post.slug}`}
                        aria-label={t("readAria", { title: post.title })}
                        className="group grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-x-5 gap-y-3 py-6 sm:grid-cols-[7rem_9rem_minmax(0,1fr)] sm:gap-x-7"
                      >
                        <span className="label pt-1 text-muted-foreground">
                          {post.publishedAt ? formatDate(post.publishedAt) : ""}
                        </span>
                        <Cover
                          post={post}
                          format="small"
                          sizes="160px"
                          className="col-start-1 row-start-2 aspect-[4/3] sm:col-start-2 sm:row-start-1"
                        />
                        <div className="col-start-2 row-start-1 min-w-0 sm:col-start-3">
                          <h3 className="text-2xl leading-tight font-semibold group-hover:text-ember">
                            {post.title}
                          </h3>
                          {post.excerpt ? (
                            <p className="mt-2 line-clamp-2 font-serif leading-relaxed text-muted-foreground">
                              {post.excerpt}
                            </p>
                          ) : null}
                          {topicTag ? (
                            <span className={cn(tagChipClass(topicTag), "mt-3")}>{topicTag.name}</span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
