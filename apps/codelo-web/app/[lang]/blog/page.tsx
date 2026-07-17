import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight, Calendar } from "lucide-react";
import { getLatestPosts, type CmsTag } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { PostCover } from "@/components/PostCover";
import { PostCoverFallback } from "@/components/PostCoverFallback";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import type { Metadata } from "next";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return { alternates: localizedAlternates(lang, "/blog") };
}

function tagChipClass(tag: CmsTag, size: "sm" | "md" = "sm"): string {
  const base = "inline-flex w-fit items-center rounded-full font-medium transition-colors";
  const sizing = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  const variant =
    tag.kind === "event"
      ? "border border-primary/30 bg-primary/5 text-primary"
      : "border border-border bg-muted text-foreground";
  return cn(base, sizing, variant);
}

export default async function BlogIndexPage() {
  const locale = (await getLocale()) as Locale;
  const posts = await getLatestPosts(30, locale);
  const [featured, ...rest] = posts;
  const featuredTag = featured?.tags.find((t) => t.kind === "topic") ?? featured?.tags[0];
  const t = await getTranslations("blog");
  const formatDate = (iso: string) => formatShortDate(iso, locale);

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground">
      <section className="mx-auto w-full max-w-6xl px-6 pt-12 sm:pt-16">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{t("eyebrow")}</p>
          <h1 className="font-display text-4xl tracking-tight text-foreground sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
            {t("tagline")}
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          <>
            {featured ? (
              <Link
                href={`/blog/${featured.slug}`}
                className={cn(
                  "group relative mt-10 grid gap-6 overflow-hidden rounded-2xl border border-border bg-card transition-all hover:border-primary/40 hover:shadow-lg lg:grid-cols-2 lg:gap-0",
                )}
              >
                <div className="relative aspect-[16/10] overflow-hidden lg:aspect-auto">
                  {featured.coverImage ? (
                    <PostCover
                      image={featured.coverImage}
                      alt={featured.title}
                      format="large"
                      priority
                      sizes="(min-width: 1024px) 50vw, 100vw"
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <PostCoverFallback
                      title={featured.title}
                      seed={featured.slug}
                      kicker={featuredTag?.name}
                      className="transition-transform duration-500 group-hover:scale-105"
                    />
                  )}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent lg:from-transparent"
                  />
                </div>
                <div className="flex flex-col gap-5 p-6 sm:p-10">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                      {t("featured")}
                    </span>
                    {featuredTag ? <span className={tagChipClass(featuredTag, "sm")}>{featuredTag.name}</span> : null}
                  </div>
                  <h2 className="font-display text-3xl leading-[1.1] tracking-tight text-foreground transition-colors group-hover:text-primary sm:text-4xl lg:text-5xl">
                    {featured.title}
                  </h2>
                  {featured.excerpt ? (
                    <p className="font-serif text-base leading-relaxed text-muted-foreground sm:text-lg">
                      {featured.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {featured.publishedAt ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="size-3.5" aria-hidden />
                        <time dateTime={featured.publishedAt}>{formatDate(featured.publishedAt)}</time>
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 font-medium text-primary transition-transform group-hover:translate-x-0.5">
                      {t("readPost")}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            ) : null}

            {rest.length > 0 ? (
              <div className="mt-12">
                <h2 className="mb-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  {t("moreNotes")}
                </h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {rest.map((post) => {
                    const topicTag = post.tags.find((tag) => tag.kind === "topic") ?? post.tags[0];
                    return (
                      <article
                        key={post.id}
                        className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
                      >
                        <Link
                          href={`/blog/${post.slug}`}
                          aria-label={t("readAria", { title: post.title })}
                          className="absolute inset-0 z-10"
                        />
                        <div className="relative aspect-[16/10] overflow-hidden">
                          {post.coverImage ? (
                            <PostCover
                              image={post.coverImage}
                              alt={post.title}
                              format="small"
                              sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                              className="h-full w-full transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <PostCoverFallback
                              title={post.title}
                              seed={post.slug}
                              kicker={topicTag?.name}
                              className="transition-transform duration-300 group-hover:scale-105"
                            />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-3 p-6">
                          {topicTag ? (
                            <span className={cn(tagChipClass(topicTag, "sm"), "pointer-events-none")}>{topicTag.name}</span>
                          ) : null}
                          <h3 className="font-display text-xl leading-tight tracking-tight text-foreground transition-colors group-hover:text-primary">
                            {post.title}
                          </h3>
                          {post.excerpt ? (
                            <p className="line-clamp-3 font-serif text-sm leading-relaxed text-muted-foreground">
                              {post.excerpt}
                            </p>
                          ) : null}
                          <div className="mt-auto flex items-center justify-between pt-2 text-xs text-muted-foreground">
                            {post.publishedAt ? (
                              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                            ) : (
                              <span />
                            )}
                            <ArrowUpRight
                              className="size-4 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                              aria-hidden
                            />
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
