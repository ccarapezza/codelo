"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, VisuallyHidden } from "radix-ui";

/** Lo que el visor necesita de una imagen: sirve igual para fotos y gráficas. */
export type ItemLightbox = { src: string; width: number; height: number; alt: string };

export type EtiquetasLightbox = {
  /** Plantilla del rótulo, con `{n}` y `{total}`: "Foto {n} de {total}". */
  item: string;
  anterior: string;
  siguiente: string;
  cerrar: string;
};

export function rotular(plantilla: string, n: number, total: number): string {
  return plantilla.replace("{n}", String(n)).replace("{total}", String(total));
}

/**
 * Visor a pantalla completa, controlado: quien lo usa guarda el índice
 * abierto (`null` = cerrado) y decide adónde vuelve el foco al cerrar.
 *
 * Radix Dialog del paquete `radix-ui`, y no `components/ui/dialog.tsx`: aquel
 * es un modal chico con bordes redondeados y zoom, lo contrario de la casa.
 * Acá: fondo de tinta, sin bordes redondeados ni sombras, sin animación si el
 * sistema pide movimiento reducido. Teclado: ← y → recorren (en círculo), Esc
 * cierra y el foco vuelve a la miniatura de la imagen que se estaba viendo.
 *
 * El título del diálogo es el rótulo ("Foto 3 de 24"), oculto a la vista
 * porque el contador visible ya lo dice; es el nombre accesible del diálogo.
 */
export function Lightbox({
  items,
  indice,
  onCambiar,
  onCerrar,
  onDevolverFoco,
  etiquetas,
}: {
  items: readonly ItemLightbox[];
  indice: number | null;
  onCambiar: (indice: number) => void;
  onCerrar: () => void;
  /** Recibe el índice que se estaba viendo al cerrar. */
  onDevolverFoco: (indice: number) => void;
  etiquetas: EtiquetasLightbox;
}) {
  const total = items.length;
  const abierto = indice !== null && total > 0;
  const i = indice === null ? 0 : Math.min(Math.max(indice, 0), total - 1);
  const item = items[i];

  // El índice visto por última vez. Se guarda en un efecto y no en el render:
  // al cerrar, el render ya llega con `indice === null` y perdería cuál era.
  const ultimo = useRef(i);
  useEffect(() => {
    if (indice !== null) ultimo.current = indice;
  }, [indice]);

  const rotulo = rotular(etiquetas.item, i + 1, total);
  const varias = total > 1;
  const ir = (paso: number) => onCambiar((i + paso + total) % total);

  return (
    <Dialog.Root open={abierto} onOpenChange={(o) => (o ? undefined : onCerrar())}>
      <Dialog.Portal>
        {/* Tinta plena: al 95 % se transparentaban los afiches de la página. */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-(--brand-ink) motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col text-(--brand-paper) outline-none motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-150"
          onKeyDown={(e) => {
            if (!varias) return;
            if (e.key === "ArrowRight") {
              e.preventDefault();
              ir(1);
            } else if (e.key === "ArrowLeft") {
              e.preventDefault();
              ir(-1);
            }
          }}
          onCloseAutoFocus={(e) => {
            // Radix devolvería el foco a lo que lo tenía al abrir; la miniatura
            // correcta es la de la imagen que se estaba viendo al cerrar.
            e.preventDefault();
            onDevolverFoco(ultimo.current);
          }}
        >
          <VisuallyHidden.Root asChild>
            <Dialog.Title>{rotulo}</Dialog.Title>
          </VisuallyHidden.Root>

          <div className="flex items-center justify-between gap-4 px-4 pt-3 sm:px-6">
            <p aria-hidden className="label text-(--brand-paper)/80 tabular-nums">
              {rotulo}
            </p>
            <Dialog.Close
              className="label inline-flex min-h-11 items-center gap-2 px-2 text-(--brand-paper) hover:text-(--brand-sun) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-sun)"
            >
              {etiquetas.cerrar}
              <X className="size-5" aria-hidden strokeWidth={1.5} />
            </Dialog.Close>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-3 py-3 sm:px-6">
            {item ? (
              <Image
                key={item.src}
                src={item.src}
                alt={item.alt}
                width={item.width}
                height={item.height}
                sizes="(min-width: 1280px) 1100px, (min-width: 768px) 85vw, 100vw"
                loading="eager"
                className="h-auto max-h-full w-auto max-w-full object-contain"
              />
            ) : null}
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 pb-4 sm:px-6">
            {varias ? (
              <BotonPaso onClick={() => ir(-1)} etiqueta={etiquetas.anterior}>
                <ChevronLeft className="size-6" aria-hidden strokeWidth={1.5} />
              </BotonPaso>
            ) : (
              <span />
            )}
            <Dialog.Description className="text-center font-serif text-sm leading-snug text-(--brand-paper)/85">
              {item?.alt}
            </Dialog.Description>
            {varias ? (
              <BotonPaso onClick={() => ir(1)} etiqueta={etiquetas.siguiente}>
                <ChevronRight className="size-6" aria-hidden strokeWidth={1.5} />
              </BotonPaso>
            ) : (
              <span />
            )}
          </div>

          {/* Al recorrer con las flechas, el título del diálogo no se vuelve a
              anunciar: esta región avisa qué imagen quedó a la vista. */}
          <VisuallyHidden.Root aria-live="polite">{item ? `${rotulo}: ${item.alt}` : ""}</VisuallyHidden.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function BotonPaso({
  onClick,
  etiqueta,
  children,
}: {
  onClick: () => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className="inline-flex size-11 items-center justify-center border border-(--brand-paper)/30 text-(--brand-paper) hover:border-(--brand-sun) hover:text-(--brand-sun) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--brand-sun)"
    >
      {children}
    </button>
  );
}
