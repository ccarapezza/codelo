"use client";

import * as React from "react";
import { Newspaper, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type NewsTeaserItem = {
  title: string;
  slug: string;
};

type Props = {
  items: NewsTeaserItem[];
  /** ms each headline stays before crossfading to the next. */
  intervalMs?: number;
};

/**
 * Small translucent news teaser pinned top-left (desktop only). Cycles the
 * latest headlines with a subtle fade — a low-key visual hook that nudges
 * readers toward the news section. Each headline links to its post; the
 * header arrow links to the full blog.
 */
export function NewsTeaser({ items, intervalMs = 5000 }: Props) {
  const t = useTranslations("news");
  const [index, setIndex] = React.useState(0);
  const [shown, setShown] = React.useState(true);

  React.useEffect(() => {
    if (items.length <= 1) return;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const cycle = setInterval(() => {
      // Fade the current headline out, swap while invisible, fade the next in.
      setShown(false);
      fadeTimer = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setShown(true);
      }, 350);
    }, intervalMs);
    return () => {
      clearInterval(cycle);
      clearTimeout(fadeTimer);
    };
  }, [items.length, intervalMs]);

  if (items.length === 0) return null;
  const current = items[index % items.length];

  return (
    // Anchored to the hero's content column — the SAME mx-auto max-w-7xl px-6
    // box as the "World Cup 2026" title — so the card's left edge lines up
    // with the title instead of the viewport edge.
    // `absolute` (not `fixed`): the card lives inside the hero and scrolls
    // away with it instead of following the viewport. The page root is
    // `relative`, so this anchors to the top of the page CONTENT. The Fulbo
    // logo is `self-start h-28` (112px on lg) so it overflows downward as a
    // masthead — top-32 (128px) drops the card clear below it.
    // pointer-events-none on the full-width strip so only the card is
    // interactive; the rest of the hero stays clickable behind it.
    <div className="pointer-events-none absolute inset-x-0 top-32 z-30 hidden lg:block">
      <div className="mx-auto w-full max-w-7xl px-6">
        <aside aria-label={t("ariaLabel")} className="pointer-events-auto w-72">
          {/* Frosted dark glass — the card always sits over the dark hero video
              (in BOTH themes), so a translucent dark tint + blur reads as real
              glass and keeps light text crisp, instead of a near-opaque white
              panel. Light text/brand-green are used regardless of theme. */}
          <div className="overflow-hidden rounded-xl border border-white/15 bg-black/25 shadow-lg shadow-black/30 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
              {/* Brand green pops on the dark glass; a faint shadow lifts the
                  "NOTICIAS" label off busier frames of the video. */}
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]">
                <Newspaper className="size-3.5" aria-hidden />
                {t("eyebrow")}
              </span>
              <Link
                href="/blog"
                aria-label={t("viewAll")}
                className="text-white/70 transition-colors hover:text-primary"
              >
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            </div>

            <Link href={`/blog/${current.slug}`} className="group block px-3.5 py-3">
              <p
                className={cn(
                  "line-clamp-2 text-sm font-medium leading-snug text-white/90 transition-all duration-300 group-hover:text-primary",
                  shown ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
                )}
              >
                {current.title}
              </p>
            </Link>

            {items.length > 1 ? (
              <div className="flex items-center gap-1 px-3.5 pb-3">
                {items.map((item, i) => (
                  <span
                    key={item.slug}
                    className={cn(
                      "h-1 rounded-full transition-all duration-300",
                      i === index % items.length ? "w-3 bg-primary" : "w-1 bg-white/30",
                    )}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
