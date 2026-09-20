import Image from "next/image";
import { LAMINAS, LAMINAS_FONDO } from "@/lib/laminas";
import { cn } from "@/lib/utils";

// On-brand covers for posts with no image yet: a two-ink botanical plate from
// the house set (see lib/laminas.ts) with the title printed on its paper.
// Deterministic by seed (the post slug) so a given note always gets the same
// plate across renders and surfaces. Used as a graceful fallback until a real
// cover exists — see the CMS publish hook (ensurePostCover) that backfills
// real AI covers over time.
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
  /** Stable key (slug) → picks a consistent plate. */
  seed: string;
  kicker?: string;
  showTitle?: boolean;
  className?: string;
}) {
  const lamina = LAMINAS_FONDO[hashSeed(seed) % LAMINAS_FONDO.length];
  return (
    <div className={cn("relative flex h-full w-full flex-col justify-end overflow-hidden", className)}>
      <Image
        src={LAMINAS[lamina]}
        alt=""
        fill
        sizes="(min-width: 1024px) 33vw, 100vw"
        className="object-cover"
      />
      {/* Velo del propio papel de la lámina para asentar el texto; los colores
          son constantes de marca porque la lámina no sigue al tema. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-(--brand-paper) via-(--brand-paper)/60 to-transparent"
      />
      <div className="relative flex flex-col gap-1.5 p-5">
        {/* Ocre fijo (el paso claro de --data-rnc, validado ≥3:1 sobre el
            papel): --data-rnc sigue al tema y este papel no. */}
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-[#b96831]">
          {kicker}
        </span>
        {showTitle ? (
          <span className="line-clamp-3 font-display text-lg leading-tight tracking-tight text-(--brand-ink) sm:text-xl">
            {title}
          </span>
        ) : null}
      </div>
    </div>
  );
}
