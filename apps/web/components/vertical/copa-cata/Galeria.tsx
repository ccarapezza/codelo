"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Lightbox, type EtiquetasLightbox, type ItemLightbox } from "./Lightbox";
import { Riel } from "./Riel";

export type ItemGaleria = ItemLightbox & {
  /** La imagen de la lista. Fotos: el formato `small` de Strapi. */
  miniatura: string;
  /** Rótulo corto bajo la pieza (gráficas: "Afiche", "Flyer"). */
  rotulo?: string;
};

export type EtiquetasGaleria = EtiquetasLightbox & {
  /** Nombre de la lista y de las flechas del riel. */
  lista: string;
  rielAnterior?: string;
  rielSiguiente?: string;
};

/**
 * Las imágenes de una edición, que abren el visor.
 *
 * `mosaico` (fotos): columnas que respetan la proporción de cada foto, en el
 * duotono de la casa (`.cover-treatment--suave`) y servidas tal cual desde los
 * formatos que ya generó Strapi (`unoptimized`): el optimizador del servidor
 * tiene poca memoria y la lista no lo necesita. Ampliadas, en color.
 *
 * `riel` (gráficas): afiches, flyers y logos enteros —son arte plano— a la
 * misma altura, en una fila que se desliza.
 *
 * El orden del visor es el de la lista: en el mosaico, columna por columna,
 * igual que el Tab.
 */
export function Galeria({
  items,
  variante,
  etiquetas,
}: {
  items: readonly ItemGaleria[];
  variante: "mosaico" | "riel";
  etiquetas: EtiquetasGaleria;
}) {
  const [indice, setIndice] = useState<number | null>(null);
  const botones = useRef<Array<HTMLButtonElement | null>>([]);

  const boton = (item: ItemGaleria, i: number, contenido: React.ReactNode, className?: string) => (
    <button
      type="button"
      ref={(el) => {
        botones.current[i] = el;
      }}
      aria-haspopup="dialog"
      onClick={() => setIndice(i)}
      className={cn("copa-brillo group block text-left", className)}
    >
      {contenido}
    </button>
  );

  const visor = (
    <Lightbox
      items={items}
      indice={indice}
      onCambiar={setIndice}
      onCerrar={() => setIndice(null)}
      onDevolverFoco={(i) => botones.current[i]?.focus()}
      etiquetas={etiquetas}
    />
  );

  if (variante === "riel") {
    return (
      <>
        <Riel
          etiqueta={etiquetas.lista}
          anterior={etiquetas.rielAnterior ?? etiquetas.anterior}
          siguiente={etiquetas.rielSiguiente ?? etiquetas.siguiente}
        >
          {items.map((item, i) => (
            <li key={item.src}>
              {boton(
                item,
                i,
                <>
                  <span
                    className="block h-56 overflow-hidden rounded-sm sm:h-72"
                    style={{ aspectRatio: `${item.width} / ${item.height}` }}
                  >
                    <Image
                      src={item.miniatura}
                      alt={item.alt}
                      width={item.width}
                      height={item.height}
                      sizes="(min-width: 640px) 288px, 224px"
                      className="block h-full w-auto"
                    />
                  </span>
                  {item.rotulo ? (
                    <span className="label mt-2.5 block text-muted-foreground group-hover:text-foreground">
                      {item.rotulo}
                    </span>
                  ) : null}
                </>,
                "rounded-sm",
              )}
            </li>
          ))}
        </Riel>
        {visor}
      </>
    );
  }

  // Nunca más columnas que fotos: una sola foto en un quinto del ancho se
  // perdía, y cuatro en cinco columnas dejaban un hueco a la derecha.
  const columnas =
    items.length === 1
      ? "max-w-xl columns-1"
      : items.length === 2
        ? "max-w-4xl columns-2"
        : items.length === 3
          ? "columns-2 sm:columns-3"
          : items.length === 4
            ? "columns-2 sm:columns-3 lg:columns-4"
            : "columns-2 sm:columns-3 lg:columns-4 xl:columns-5";

  return (
    <>
      <ul aria-label={etiquetas.lista} className={cn("gap-2 sm:gap-3", columnas)}>
        {items.map((item, i) => (
          <li key={item.src} className="mb-2 break-inside-avoid sm:mb-3">
            {boton(
              item,
              i,
              <span className="cover-treatment cover-treatment--suave block overflow-hidden rounded-sm">
                <Image
                  src={item.miniatura}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  unoptimized
                  sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="block h-auto w-full"
                />
              </span>,
              "w-full rounded-sm",
            )}
          </li>
        ))}
      </ul>
      {visor}
    </>
  );
}
