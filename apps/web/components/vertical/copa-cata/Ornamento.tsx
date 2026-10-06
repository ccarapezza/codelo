import Image from "next/image";
import { ORNAMENTOS } from "@/lib/vertical/copa-cata";
import { cn } from "@/lib/utils";

/**
 * Banda ilustrada entre bloques, o al pie de la página (`jardin`, que crece
 * desde el borde de abajo). Es decoración pura: oculta para los lectores de
 * pantalla. Se imprime con `lighten` sobre la noche, así el fondo de tinta de
 * la ilustración desaparece y queda solo el trazo (ver vertical.css).
 */
export function Ornamento({ tipo, className }: { tipo: "orbitas" | "jardin"; className?: string }) {
  const o = ORNAMENTOS[tipo];
  return (
    <div
      aria-hidden
      className={cn("copa-ornamento", tipo === "jardin" ? "copa-ornamento--cierre" : null, className)}
    >
      <Image
        src={o.src}
        alt={o.alt}
        width={o.width}
        height={o.height}
        sizes="(min-width: 1280px) 1200px, 100vw"
        className="block h-auto w-full"
      />
    </div>
  );
}
