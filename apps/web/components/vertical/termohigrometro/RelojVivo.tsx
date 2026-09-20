"use client";

import { useSyncExternalStore } from "react";

/* -------------------------------------------------------------------------- */
/* Store del minuto en curso                                                   */
/* -------------------------------------------------------------------------- */

// El instrumento no muestra segundos, así que tickear a 1 Hz sería re-render
// puro desperdicio: el store avanza UNA vez por minuto, alineado al borde del
// minuto (no cada 60 s desde que montó).
//
// El snapshot está cacheado en `minutoActual` a propósito. Si getSnapshot
// devolviera un valor nuevo en cada llamada, React lanza "The result of
// getSnapshot should be cached to avoid an infinite loop" y cuelga la página.
// (hooks/useLocalZone.ts esquiva esto por accidente: su store es no-op.)

const MINUTO = 60_000;

let minutoActual: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

const bordeDeMinuto = () => Math.floor(Date.now() / MINUTO) * MINUTO;

function programar() {
  // +50 ms de colchón para caer del lado correcto del borde.
  timer = setTimeout(() => {
    minutoActual = bordeDeMinuto();
    for (const cb of oyentes) cb();
    programar();
  }, MINUTO - (Date.now() % MINUTO) + 50);
}

function subscribe(cb: () => void) {
  oyentes.add(cb);
  if (oyentes.size === 1) programar();
  return () => {
    oyentes.delete(cb);
    if (oyentes.size === 0) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}

function getSnapshot(): number | null {
  if (minutoActual === null) minutoActual = bordeDeMinuto();
  return minutoActual;
}

// Durante SSR y el primer render de hidratación no hay reloj del cliente: se
// usa la hora que calculó el server. Por eso no hace falta
// `suppressHydrationWarning` — el markup coincide por construcción.
const getServerSnapshot = (): number | null => null;

/* -------------------------------------------------------------------------- */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatear(ms: number, zona: string): string {
  let f = formatters.get(zona);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: zona,
      });
    } catch {
      // Zona IANA inválida (Open-Meteo devolvió algo raro): sin timeZone,
      // cae a la del dispositivo.
      f = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    formatters.set(zona, f);
  }
  return f.format(new Date(ms));
}

/**
 * Hora actual en la zona de la estación (no la del visitante): si alguien
 * consulta Córdoba, el reloj tiene que decir la hora de Córdoba.
 *
 * `horaServidor` es esa misma hora ya formateada por el RSC — es lo que se
 * pinta en SSR y en el primer render del cliente.
 *
 * Es un hook y no un componente con children-as-function a propósito: una
 * función no cruza el límite RSC → Client ("Functions are not valid as a child
 * of Client Components"). Cada variante envuelve esto en su propio componente
 * cliente y lo dibuja como quiera.
 */
export function useHoraViva(zona: string, horaServidor: string): string {
  const ms = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return ms === null ? horaServidor : formatear(ms, zona);
}
