import * as React from "react";

// El WidgetRoot de Strapi encierra el cuerpo de cada widget en un Box con
// `height: 261px; overflow: auto`, lo que fuerza scroll cuando el contenido no
// entra. No se puede cambiar por CSS de forma confiable (haría falta `:has()`
// para alcanzar al padre, y el minificador del build de dev lo descarta), ni
// desde el JSX (ese Box es el padre). Así que cada widget de codelo, al montar,
// destapa a mano el alto de su contenedor scrolleable para que la tarjeta crezca
// en vez de scrollear. El contenido ya envuelve solo, así que no hay overflow
// horizontal que recortar.
//
// Se busca el ancestro scrolleable (no se asume que sea el padre directo) para
// tolerar que Strapi meta wrappers intermedios en el futuro.
function findScrollBox(start: Element | null): HTMLElement | null {
  let cur = start?.parentElement ?? null;
  for (let i = 0; i < 4 && cur; i++) {
    const oy = getComputedStyle(cur).overflowY;
    if (oy === "auto" || oy === "scroll") return cur;
    cur = cur.parentElement;
  }
  return null;
}

export function useUncapHeight(): void {
  React.useEffect(() => {
    const uncap = () => {
      document.querySelectorAll<HTMLElement>(".nib-widget-body").forEach((body) => {
        const box = findScrollBox(body);
        if (box && box.dataset.uncapped !== "1") {
          box.style.height = "auto";
          box.style.maxHeight = "none";
          box.style.overflow = "hidden"; // alto ya ajustado al contenido: no recorta
          box.dataset.uncapped = "1";
        }
      });
    };
    uncap();
    // Los widgets con fetch montan su cuerpo un tick después (datos async).
    const t = window.setTimeout(uncap, 60);
    return () => window.clearTimeout(t);
  });
}
