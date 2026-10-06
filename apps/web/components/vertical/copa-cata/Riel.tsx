"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un riel horizontal: una fila que se desliza con el dedo, el trackpad o la
 * rueda con Mayús, y que frena en cada pieza (scroll-snap). Los hijos son los
 * `<li>`; pueden ser componentes del servidor.
 *
 * Las flechas son para el mouse de escritorio, donde arrastrar de costado no
 * es natural: aparecen solo si la fila desborda y se apagan en cada punta. Con
 * teclado no hacen falta —el Tab lleva el foco a la pieza siguiente y el
 * navegador la trae a la vista—, pero se pueden usar igual.
 */
export function Riel({
  children,
  etiqueta,
  anterior,
  siguiente,
  className,
}: {
  children: React.ReactNode;
  /** Nombre de la lista para lectores de pantalla. */
  etiqueta: string;
  /** Texto de las flechas ("Ver anteriores", "Ver siguientes"). */
  anterior: string;
  siguiente: string;
  className?: string;
}) {
  const fila = useRef<HTMLUListElement>(null);
  const [puede, setPuede] = useState({ atras: false, adelante: false });

  const medir = useCallback(() => {
    const el = fila.current;
    if (!el) return;
    // Un píxel de tolerancia: con zoom el scrollLeft llega con decimales.
    setPuede({
      atras: el.scrollLeft > 1,
      adelante: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = fila.current;
    if (!el) return;
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const observador = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(medir);
    observador?.observe(el);
    return () => {
      el.removeEventListener("scroll", medir);
      observador?.disconnect();
    };
  }, [medir]);

  const mover = (sentido: 1 | -1) => {
    const el = fila.current;
    if (!el) return;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: sentido * el.clientWidth * 0.85, behavior: quieto ? "auto" : "smooth" });
  };

  const hayFlechas = puede.atras || puede.adelante;

  return (
    <div className={cn("relative", className)}>
      {/* Las flechas flotan arriba de la fila, a la altura del título del
          bloque: así no corren la fila cuando aparecen después de medir. */}
      {hayFlechas ? (
        <div className="absolute right-[var(--riel-margen,0px)] bottom-full mb-3 hidden gap-2 sm:flex">
          <Flecha onClick={() => mover(-1)} disabled={!puede.atras} etiqueta={anterior}>
            <ArrowLeft className="size-4" aria-hidden strokeWidth={1.75} />
          </Flecha>
          <Flecha onClick={() => mover(1)} disabled={!puede.adelante} etiqueta={siguiente}>
            <ArrowRight className="size-4" aria-hidden strokeWidth={1.75} />
          </Flecha>
        </div>
      ) : null}
      <ul ref={fila} aria-label={etiqueta} className="copa-riel">
        {children}
      </ul>
    </div>
  );
}

function Flecha({
  onClick,
  disabled,
  etiqueta,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={etiqueta}
      className="copa-brillo inline-flex size-10 items-center justify-center rounded-full border border-rule text-foreground disabled:opacity-35"
    >
      {children}
    </button>
  );
}
