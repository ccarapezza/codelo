import { getLocale, getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import type { CmsPostListItem } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { formatShortDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import { PostCover } from "./PostCover";
import { PostCoverFallback } from "./PostCoverFallback";
import { cn } from "@/lib/utils";

const WORDS_PER_MINUTE = 225;
function readingMinutesFromExcerpt(post: CmsPostListItem): number | null {
  if (!post.excerpt) return null;
  // Rough estimate from excerpt length × 8 (avg expansion factor for full content).
  const words = post.excerpt.trim().split(/\s+/).filter(Boolean).length * 8;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

type Props = {
  post: CmsPostListItem;
  /** First/featured row gets a slightly bigger headline. */
  prominent?: boolean;
};

export async function PostListItem({ post, prominent = false }: Props) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("postListItem");
  const eyebrowTags = post.tags.slice(0, 2);
  const minutes = readingMinutesFromExcerpt(post);

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group relative grid gap-5 py-8 transition-opacity sm:grid-cols-[1fr_auto] sm:gap-10 sm:py-10"
    >
      <div className="flex flex-col gap-3">
        {eyebrowTags.length > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
            {eyebrowTags.map((tag, idx) => (
              <span key={tag.slug} className="inline-flex items-center gap-2">
                {idx > 0 ? <span aria-hidden className="text-border">·</span> : null}
                <span className={tag.kind === "event" ? "text-primary" : ""}>{tag.name}</span>
              </span>
            ))}
          </p>
        ) : null}

        <h3
          className={cn(
            "font-display leading-[1.1] tracking-tight text-foreground transition-colors group-hover:text-primary",
            prominent ? "text-3xl sm:text-4xl lg:text-[2.75rem]" : "text-2xl sm:text-3xl",
          )}
        >
          {post.title}
        </h3>

        {post.excerpt ? (
          <p
            className={cn(
              "font-serif leading-relaxed text-muted-foreground",
              prominent ? "text-base line-clamp-3 sm:text-lg" : "text-sm line-clamp-2 sm:text-base",
            )}
          >
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {post.authorName ? (
            <span className="font-medium text-foreground/80">{post.authorName}</span>
          ) : null}
          {post.authorName && post.publishedAt ? (
            <span aria-hidden className="text-border">·</span>
          ) : null}
          {post.publishedAt ? (
            <time dateTime={post.publishedAt}>{formatShortDate(post.publishedAt, locale)}</time>
          ) : null}
          {minutes ? (
            <>
              <span aria-hidden className="text-border">·</span>
              <span>{minutes} min</span>
            </>
          ) : null}
          <span
            aria-hidden
            className="ml-auto inline-flex translate-x-0 items-center gap-1 text-primary opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 sm:ml-2"
          >
            {t("read")}
            <ArrowUpRight className="size-3.5" />
          </span>
        </div>
      </div>

      <div
        className={cn(
          "row-start-1 overflow-hidden rounded-md",
          prominent ? "h-40 w-full sm:h-48 sm:w-72 lg:h-56 lg:w-80" : "h-32 w-full sm:h-36 sm:w-56 lg:h-40 lg:w-64",
          "sm:row-start-auto",
        )}
      >
        {post.coverImage ? (
          <PostCover
            image={post.coverImage}
            alt={post.title}
            format={prominent ? "medium" : "small"}
            sizes={prominent ? "(min-width: 1024px) 320px, (min-width: 640px) 288px, 100vw" : "(min-width: 1024px) 256px, (min-width: 640px) 224px, 100vw"}
            className="h-full w-full transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <PostCoverFallback
            title={post.title}
            seed={post.slug}
            kicker={post.tags[0]?.name}
            className="transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
    </Link>
  );
}
