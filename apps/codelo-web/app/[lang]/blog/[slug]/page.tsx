import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { getPostBySlug, getLatestPosts, resolvePostRedirect, type CmsTag } from "@/lib/cms";
import { Link, redirect } from "@/i18n/navigation";
import { SetLocaleAlternates, type LocaleAlternates } from "@/components/locale-alternates";
import { markdownToSafeHtml, readingTimeMinutes, stripLeadingTitle } from "@/lib/markdown";
import { PostCover } from "@/components/PostCover";
import { PostListItem } from "@/components/PostListItem";
import { cn } from "@/lib/utils";
import { formatPostDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import { JsonLd } from "@/components/JsonLd";
import {
  localizedAlternates,
  articleSchema,
  breadcrumbSchema,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const post = await getPostBySlug(slug, lang as Locale);
  if (!post) return {};

  // og:image / twitter:image are produced by the co-located opengraph-image.tsx
  // — a lightweight branded card (cover + title) that stays under WhatsApp's
  // ~300KB preview limit, unlike the full-size cover PNG we pointed at before.
  const canonicalPath = `/blog/${post.slug}`;
  const description = post.excerpt ?? undefined;

  // hreflang per locale with each translation's own slug; locales without a
  // published translation are omitted.
  const localePaths: Partial<Record<string, string>> = {};
  for (const [l, s] of Object.entries(post.alternates)) localePaths[l] = `/blog/${s}`;

  return {
    title: post.title,
    description,
    alternates: localizedAlternates(lang, canonicalPath, localePaths),
    openGraph: {
      type: "article",
      url: `/${lang}${canonicalPath}`,
      title: post.title,
      description,
      publishedTime: post.publishedAt ?? undefined,
      authors: post.authorName ? [post.authorName] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
    },
  };
}

function formatDate(iso: string, locale: Locale): string {
  return formatPostDate(iso, locale);
}

function tagHref(tag: CmsTag): string | null {
  // Tag detail pages do not exist yet in the F1 vertical; chips render as
  // plain labels; kind=event tags could link to /actividades later.
  void tag;
  return null;
}

function tagChipClass(tag: CmsTag, size: "sm" | "md" = "md"): string {
  const base = "inline-flex items-center rounded-full font-medium transition-colors";
  const sizing = size === "sm" ? "px-2.5 py-0.5 text-[11px]" : "px-3 py-1 text-xs";
  const variant =
    tag.kind === "event"
      ? "border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
      : "border border-border bg-muted text-foreground hover:bg-muted/80";
  return cn(base, sizing, variant);
}

function TagChip({ tag, size = "md" }: { tag: CmsTag; size?: "sm" | "md" }) {
  const href = tagHref(tag);
  const className = tagChipClass(tag, size);
  return href ? (
    <Link href={href} className={className}>
      {tag.name}
    </Link>
  ) : (
    <span className={className}>{tag.name}</span>
  );
}

export default async function BlogPostPage({ params }: { params: Promise<{ lang: Locale; slug: string }> }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("blog");
  const { slug } = await params;
  const post = await getPostBySlug(slug, locale);
  if (!post) {
    // The slug may belong to the other locale (old shared link, or a locale
    // toggle on a post without translation). Send the visitor to the right
    // URL instead of 404ing.
    const target = await resolvePostRedirect(slug, locale);
    if (target) redirect({ href: `/blog/${target.slug}`, locale: target.locale });
    notFound();
  }

  const toggleAlternates: LocaleAlternates = {};
  for (const [l, s] of Object.entries(post.alternates)) {
    toggleAlternates[l as Locale] = `/blog/${s}`;
  }

  // Drop a leading heading that just repeats the title (some AI-generated posts
  // open the content with `# Title`), so it isn't shown twice.
  const safeHtml = post.content
    ? markdownToSafeHtml(stripLeadingTitle(post.content, post.title))
    : null;
  const minutes = post.content ? readingTimeMinutes(post.content) : 0;
  const eyebrowTags = post.tags.slice(0, 2);

  const related = (await getLatestPosts(4, locale))
    .filter((p) => p.slug !== post.slug)
    .slice(0, 3);

  const cover = post.coverImage;
  // Original upload (highest resolution) for the BlogPosting JSON-LD image.
  const coverUrl = cover?.url ?? null;
  const absImage = coverUrl
    ? coverUrl.startsWith("http")
      ? coverUrl
      : `${SITE_URL}${coverUrl}`
    : null;
  const jsonLd = [
    articleSchema({
      title: post.title,
      description: post.excerpt,
      lang: locale,
      slug: post.slug,
      image: absImage,
      datePublished: post.publishedAt,
      authorName: post.authorName,
    }),
    breadcrumbSchema([
      { name: SITE_NAME, url: `${SITE_URL}/${locale}` },
      { name: "Blog", url: `${SITE_URL}/${locale}/blog` },
      { name: post.title, url: `${SITE_URL}/${locale}/blog/${post.slug}` },
    ]),
  ];

  return (
    <article className="min-h-screen bg-background pb-24 text-foreground">
      <SetLocaleAlternates alternates={toggleAlternates} />
      <JsonLd data={jsonLd} />
      {/* Right-aligned at every size: the masthead logo (header) overflows
          downward over the top-left, so a left-aligned back-link gets covered. */}
      <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pt-6">
        <Link
          href="/blog"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
          {t("backToBlog")}
        </Link>
      </div>

      {post.coverImage ? (
        <div className="mx-auto mt-6 w-full max-w-6xl px-6 sm:mt-8">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg sm:aspect-[2/1]">
            <PostCover
              image={post.coverImage}
              alt={post.title}
              format="large"
              priority
              sizes="(min-width: 1280px) 1152px, 100vw"
              className="h-full w-full"
            />
          </div>
        </div>
      ) : null}

      <header className="mx-auto w-full max-w-3xl px-6 pt-10 sm:pt-14">
        <div className="flex flex-col gap-5">
          {eyebrowTags.length > 0 ? (
            <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em]">
              {eyebrowTags.map((tag, idx) => (
                <span key={tag.slug} className="inline-flex items-center gap-2">
                  {idx > 0 ? <span aria-hidden className="text-border">·</span> : null}
                  <span className="text-primary">
                    {tag.name}
                  </span>
                </span>
              ))}
            </p>
          ) : null}

          <h1 className="font-display text-4xl leading-[1.05] tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {post.title}
          </h1>

          {post.excerpt ? (
            <p className="font-serif text-lg leading-relaxed text-muted-foreground sm:text-xl">
              {post.excerpt}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {post.authorName ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground/80">
                <User className="size-3.5" aria-hidden />
                {post.authorName}
              </span>
            ) : null}
            {post.authorName && post.publishedAt ? (
              <span aria-hidden className="text-border">·</span>
            ) : null}
            {post.publishedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5" aria-hidden />
                <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
              </span>
            ) : null}
            {minutes > 0 ? (
              <>
                <span aria-hidden className="text-border">·</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  {t("readingTime", { minutes })}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl px-6 pt-12">
        {safeHtml ? (
          <div
            className={cn(
              "prose prose-lg max-w-none",
              "prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground",
              "prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h2:border-b prose-h2:border-border prose-h2:pb-2 sm:prose-h2:text-3xl",
              "prose-h3:mt-8 prose-h3:text-xl",
              "prose-p:font-serif prose-p:leading-[1.75] prose-p:text-foreground/90",
              "prose-strong:font-semibold prose-strong:text-foreground",
              "prose-em:font-serif prose-em:italic prose-em:text-muted-foreground",
              "prose-a:text-primary prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
              "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:font-serif prose-blockquote:text-foreground",
              "prose-ul:font-serif prose-ol:font-serif prose-li:leading-[1.7] prose-li:text-foreground/90 prose-li:marker:text-primary",
              "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-mono prose-code:text-primary prose-code:before:content-none prose-code:after:content-none",
              "prose-hr:my-12 prose-hr:border-border",
              "prose-img:rounded-lg prose-img:border prose-img:border-border",
            )}
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            {t("emptyContent")}
          </div>
        )}


        {post.tags.length > 0 ? (
          <footer className="mt-16 border-t border-border pt-8">
            <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              {t("tags")}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <TagChip key={tag.slug} tag={tag} />
              ))}
            </div>
          </footer>
        ) : null}
      </div>

      {related.length > 0 ? (
        <section className="mx-auto mt-20 w-full max-w-4xl px-6">
          <header className="mb-2 flex items-end justify-between gap-4 border-b border-border pb-4">
            <h2 className="font-display text-2xl tracking-tight text-foreground sm:text-3xl">
              {t("keepReading")}
            </h2>
            <Link
              href="/blog"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              {t("viewAll")}
            </Link>
          </header>
          <div>
            {related.map((p) => (
              <div key={p.id} className="border-b border-border last:border-b-0">
                <PostListItem post={p} />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
