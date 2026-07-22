"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

// useLayoutEffect avisa en el render del servidor; medir sólo tiene sentido en
// el cliente, así que en SSR degrada a useEffect (que allí tampoco corre).
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * Carousel for the front-page featured stories.
 *
 * Server-rendered slides come in as children — one per featured post — so the
 * covers and headlines are in the HTML and readable without JS. This component
 * only adds the sliding.
 *
 * Motion decisions, in case they need revisiting:
 *  - Transform-based slide, 520 ms, ease-out. No bounce: this is a newspaper
 *    front page, and springy overshoot reads as a marketing widget.
 *  - Autoplay pauses on hover, on keyboard focus, and while the tab is hidden.
 *    A headline that slides away mid-sentence is worse than no autoplay.
 *  - `prefers-reduced-motion` disables both the animation AND the autoplay —
 *    the transition is the whole point of the effect, so with motion off the
 *    slides just cut.
 */
export function FeaturedCarousel({
  children,
  labels,
  intervalMs = 7000,
}: {
  children: React.ReactNode[];
  labels: { previous: string; next: string; goTo: string; of: string };
  intervalMs?: number;
}) {
  const total = children.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [trackHeight, setTrackHeight] = useState<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // El riel es un flex, así que sin esto su alto lo fija la diapositiva MÁS
  // ALTA y las demás quedan con un hueco debajo. En desktop apenas se nota; en
  // mobile un titular de tres líneas contra uno de seis dejaba media pantalla
  // vacía. Medimos la activa y el viewport sigue ese alto.
  useIsomorphicLayoutEffect(() => {
    const el = slideRefs.current[index];
    if (!el) return;
    const medir = () => setTrackHeight(el.getBoundingClientRect().height);
    medir();
    // El alto cambia al recargar fuentes, al llegar una portada o al rotar el
    // teléfono; observar el nodo cubre los tres casos sin escuchar resize.
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, total]);

  const go = useCallback((n: number) => setIndex(((n % total) + total) % total), [total]);
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  // Autoplay. Disabled for a single slide, while paused, and under reduced motion.
  //
  // `index` va en las dependencias A PROPÓSITO: reinicia el temporizador en
  // cada cambio, incluidos los manuales. Sin eso el intervalo corre por su
  // cuenta, y un click de flecha hecho justo antes de que dispare avanza DOS
  // diapositivas de golpe — pasó en la prueba. Además garantiza que después de
  // tocar un control siempre quede el intervalo completo para leer.
  useEffect(() => {
    if (total < 2 || paused || reducedMotion) return;
    const id = window.setTimeout(() => setIndex(i => (i + 1) % total), intervalMs);
    return () => window.clearTimeout(id);
  }, [total, paused, reducedMotion, intervalMs, index]);

  // A slide changing under a backgrounded tab wastes work and lands the reader
  // somewhere unexpected when they come back.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      next();
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prev();
    }
  };

  // Touch swipe. Only horizontal intent counts — otherwise a vertical scroll
  // that drifts sideways would flip the slide out from under the reader.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
    touch.current = null;
  };

  if (total === 0) return null;
  if (total === 1) return <>{children[0]}</>;

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Notas destacadas"
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div
        ref={viewportRef}
        className="relative overflow-hidden"
        style={{
          // Sin medida todavía (SSR y primer paint) queda en auto: el alto de
          // la más alta, que es exactamente el comportamiento previo.
          height: trackHeight ?? undefined,
          transition: reducedMotion ? "none" : "height 520ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div
          className="flex items-start"
          style={{
            transform: `translate3d(-${index * 100}%, 0, 0)`,
            transition: reducedMotion ? "none" : "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {children.map((slide, i) => (
            <div
              key={i}
              ref={el => {
                slideRefs.current[i] = el;
              }}
              className="w-full shrink-0"
              // The off-screen slides stay in the DOM for SEO and no-JS, but
              // must not be reachable by tab or announced as current.
              aria-hidden={i !== index}
              inert={i !== index}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${i + 1} ${labels.of} ${total}`}
            >
              {slide}
            </div>
          ))}
        </div>

        {/* Flechas al costado, calcando la caja de la portada.
            El overlay repite el `aspect-[16/9]` de la portada en vez de cubrir
            la diapositiva entera: si no, al centrarse verticalmente caerían
            sobre el titular, que es la parte que hay que poder leer.
            `pointer-events-none` en el overlay para no bloquear el enlace de la
            nota; solo los botones vuelven a recibir el click. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex aspect-[16/9] items-center justify-between px-3 sm:px-4">
          <FlechaCarrusel onClick={prev} label={labels.previous}>
            <ArrowLeft className="size-5" aria-hidden />
          </FlechaCarrusel>
          <FlechaCarrusel onClick={next} label={labels.next}>
            <ArrowRight className="size-5" aria-hidden />
          </FlechaCarrusel>
        </div>
      </div>

      {/* Puntos centrados debajo. */}
      <ol className="mt-5 flex items-center justify-center gap-2.5">
        {children.map((_, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-label={`${labels.goTo} ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
              // El área táctil llega a 24px aunque el punto mida 10: un blanco
              // de 10px es imposible de acertar en un teléfono.
              className="flex size-6 items-center justify-center"
            >
              <span
                className="block size-2.5 rounded-full"
                style={{
                  backgroundColor: i === index ? "var(--sun)" : "transparent",
                  boxShadow: i === index ? "none" : "inset 0 0 0 1.5px var(--rule)",
                  transition: reducedMotion ? "none" : "background-color 300ms ease-out",
                }}
              />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Arrow button that sits over the cover.
 *
 * Colours are pinned rather than themed: it floats over a photograph, so it
 * needs its own contrast regardless of light or dark mode — the same reason
 * `.duotone` fixes its inks.
 */
function FlechaCarrusel({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pointer-events-auto flex size-10 items-center justify-center rounded-full text-[#f6e6cc] backdrop-blur-sm transition-colors sm:size-11"
      style={{ backgroundColor: "rgba(0, 0, 28, 0.55)" }}
    >
      {children}
    </button>
  );
}
