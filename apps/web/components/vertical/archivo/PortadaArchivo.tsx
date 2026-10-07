import Image from "next/image";
import type { Portada } from "@/lib/vertical/archivo";
import { cn } from "@/lib/utils";

/**
 * La portada de una nota del archivo, impresa según lo que es:
 *
 * - una lámina (la propia de la nota o la de su tipo) es un grabado a dos
 *   tintas sobre su propio papel, y va tal cual (`.archivo-lamina`,
 *   vertical.css): en claro se imprime sobre el papel de la página;
 * - una foto propia (las tres notas que la traen) lleva el duotono de la casa
 *   (`.cover-treatment`), para que no rompa la serie de grabados.
 *
 * El `alt` va vacío por defecto: la portada siempre acompaña a un enlace que ya
 * nombra la nota (fecha, título, firma) y el dibujo la ilustra sin agregarle
 * nada que haga falta para elegirla. La descripción de cada imagen está en el
 * manifiesto y en el CMS, que la usa en /blog/<slug>.
 *
 * Carga perezosa salvo que se pida `preload`: solo la primera del primer
 * pliegue. `sizes` lo da quien la usa, ajustado al ancho real de su columna,
 * para que el optimizador no mande una lámina de 1600 px a una miniatura.
 */
export function PortadaArchivo({
  portada,
  sizes,
  className,
  alt = "",
  preload,
}: {
  portada: Portada;
  sizes: string;
  className?: string;
  alt?: string;
  preload?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        portada.clase === "foto" ? "cover-treatment" : "archivo-lamina",
        className,
      )}
    >
      <Image
        src={portada.src}
        alt={alt}
        fill
        sizes={sizes}
        preload={preload}
        className="object-cover"
      />
    </div>
  );
}
