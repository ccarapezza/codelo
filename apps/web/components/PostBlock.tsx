import { getLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import type { CmsPostListItem, CmsTag } from "@/lib/cms";
import { Link } from "@/i18n/navigation";
import { formatShortDate } from "@/lib/intl";
import type { Locale } from "@/i18n/routing";
import { PostCover } from "./PostCover";
import { PostCoverFallback } from "./PostCoverFallback";
import { cn } from "@/lib/utils";

function formatDate(iso: string, locale: Locale): string {
  return formatShortDate(iso, locale);
}

function eyebrowColor(tag: CmsTag): string {
  if (tag.kind === "event") return "text-primary";
  return "text-primary";
}

type Variant = "featured" | "medium" | "small" | "text";

type Props = {
  post: CmsPostListItem;
  variant: Variant;
  className?: string;
  priority?: boolean;
};

const titleClass: Record<Variant, string> = {
  featured: "font-display text-3xl leading-[1.05] tracking-tight sm:text-4xl lg:text-[2.75rem]",
  medium: "font-display text-2xl leading-tight tracking-tight sm:text-[1.75rem]",
  small: "font-display text-xl leading-tight tracking-tight sm:text-2xl",
  text: "font-display text-2xl leading-[1.1] tracking-tight sm:text-3xl lg:text-4xl",
};

const aspectClass: Record<Exclude<Variant, "text">, string> = {
  featured: "aspect-[4/3] lg:aspect-[3/2]",
  medium: "aspect-[16/10]",
  small: "aspect-[16/10]",
};

const imageFormat: Record<Exclude<Variant, "text">, "small" | "medium" | "large"> = {
  featured: "large",
  medium: "medium",
  small: "small",
};

const imageSizes: Record<Exclude<Variant, "text">, string> = {
  featured: "(min-width: 1024px) 700px, 100vw",
  medium: "(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw",
  small: "(min-width: 1024px) 300px, (min-width: 640px) 50vw, 100vw",
};

export async function PostBlock({ post, variant, className, priority = false }: Props) {
  const locale = (await getLocale()) as Locale;
  const showImage = variant !== "text";
  const eyebrowTags = post.tags.slice(0, 2);
  const showExcerpt = variant === "featured" || variant === "text";

  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn("group flex h-full flex-col gap-4", className)}
    >
      {showImage ? (
        <div className={cn("relative w-full overflow-hidden rounded-md", aspectClass[variant as Exclude<Variant, "text">])}>
          {post.coverImage ? (
            <PostCover
              image={post.coverImage}
              alt={post.title}
              format={imageFormat[variant as Exclude<Variant, "text">]}
              sizes={imageSizes[variant as Exclude<Variant, "text">]}
              priority={priority}
              className="h-full w-full transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <PostCoverFallback
              title={post.title}
              seed={post.slug}
              kicker={eyebrowTags[0]?.name}
              className="transition-transform duration-500 group-hover:scale-105"
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-3">
        {eyebrowTags.length > 0 ? (
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em]">
            {eyebrowTags.map((tag, idx) => (
              <span key={tag.slug} className="inline-flex items-center gap-2">
                {idx > 0 ? <span aria-hidden className="text-border">·</span> : null}
                <span className={eyebrowColor(tag)}>{tag.name}</span>
              </span>
            ))}
          </p>
        ) : null}

        <h3 className={cn(titleClass[variant], "text-foreground transition-colors group-hover:text-primary")}>
          {post.title}
        </h3>

        {showExcerpt && post.excerpt ? (
          <p
            className={cn(
              "font-serif leading-relaxed text-muted-foreground",
              variant === "featured"
                ? "line-clamp-3 text-base sm:text-lg"
                : "line-clamp-3 text-sm sm:text-base",
            )}
          >
            {post.excerpt}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 truncate">
            {post.authorName ? (
              <span className="truncate font-medium text-foreground/80">{post.authorName}</span>
            ) : null}
            {post.authorName && post.publishedAt ? <span aria-hidden>·</span> : null}
            {post.publishedAt ? (
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
            ) : null}
          </span>
          <ArrowUpRight
            className="size-4 text-muted-foreground transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden
          />
        </div>
      </div>
    </Link>
  );
}
