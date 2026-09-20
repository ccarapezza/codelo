import { cn } from "@/lib/utils";
import { CoverFallback } from "@/components/vertical";

// Portada para las notas que todavía no tienen imagen.
//
// Es una RANURA: el motor sabe que hace falta algo donde iría la foto, y el
// proyecto decide qué. Si no aporta nada, queda un degradado con el título
// encima — sobrio y legible, que es lo mínimo que se le pide.
//
// Es un fallback transitorio: el hook de publicación del CMS (ensurePostCover)
// va generando portadas reales con el tiempo.
export function PostCoverFallback(props: {
  title: string;
  /** Clave estable (el slug) para que una nota reciba siempre lo mismo. */
  seed: string;
  kicker?: string;
  showTitle?: boolean;
  className?: string;
}) {
  if (CoverFallback) return <CoverFallback {...props} />;

  const { title, kicker, showTitle = true, className } = props;
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end overflow-hidden bg-gradient-to-br from-muted to-muted/40",
        className,
      )}
    >
      <div className="relative flex flex-col gap-1.5 p-5">
        {kicker ? (
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
            {kicker}
          </span>
        ) : null}
        {showTitle ? (
          <span className="line-clamp-3 font-display text-lg leading-tight tracking-tight sm:text-xl">
            {title}
          </span>
        ) : null}
      </div>
    </div>
  );
}
