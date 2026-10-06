import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Título de bloque de la Copa: la egipcia grande con una estrella ámbar
 * adelante. Reemplaza al filete de sección del resto del sitio: en la noche,
 * lo que separa no es una regla sino aire y luz.
 */
export function TituloSeccion({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "flex items-center gap-3 font-display text-[clamp(1.75rem,3.6vw,2.75rem)] leading-none font-semibold tracking-tight",
        className,
      )}
    >
      <Sparkle className="size-5 shrink-0 text-sun sm:size-6" aria-hidden strokeWidth={1.5} />
      {children}
    </h2>
  );
}
