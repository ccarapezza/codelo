import { cn } from "@/lib/utils";

// On-brand gradient covers for posts with no image yet. Deterministic by seed
// (the post slug) so a given note always gets the same look across renders and
// surfaces. Used as a graceful fallback until a real cover exists — see the
// CMS publish hook (ensurePostCover) that backfills real AI covers over time.
const ACCENTS = [
  { grad: "from-primary/35 via-card to-card", eyebrow: "text-primary" },
  { grad: "from-gold/30 via-card to-card", eyebrow: "text-gold" },
  { grad: "from-primary/25 via-card to-gold/15", eyebrow: "text-primary" },
  { grad: "from-chart-2/30 via-card to-card", eyebrow: "text-chart-2" },
] as const;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function PostCoverFallback({
  title,
  seed,
  kicker = "Cogollos del Oeste",
  showTitle = true,
  className,
}: {
  title: string;
  /** Stable key (slug) → picks a consistent accent. */
  seed: string;
  kicker?: string;
  showTitle?: boolean;
  className?: string;
}) {
  const accent = ACCENTS[hashSeed(seed) % ACCENTS.length];
  return (
    <div className={cn("relative flex h-full w-full flex-col justify-end overflow-hidden bg-card", className)}>
      <div aria-hidden className={cn("absolute inset-0 bg-gradient-to-br", accent.grad)} />
      {/* Concentric rings motif — reads as an intentional editorial cover. */}
      <div aria-hidden className="absolute -right-10 -top-10 size-44 rounded-full border border-foreground/10" />
      <div aria-hidden className="absolute -right-3 -top-3 size-28 rounded-full border border-foreground/10" />
      <div className="relative flex flex-col gap-1.5 p-5">
        <span className={cn("font-mono text-[10px] font-semibold uppercase tracking-[0.3em]", accent.eyebrow)}>
          {kicker}
        </span>
        {showTitle ? (
          <span className="line-clamp-3 font-display text-lg leading-tight tracking-tight text-foreground sm:text-xl">
            {title}
          </span>
        ) : null}
      </div>
    </div>
  );
}
