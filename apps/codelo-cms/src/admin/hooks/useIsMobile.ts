import * as React from "react";

// Detecta viewport angosto (celular) para cambiar el LAYOUT de las páginas
// custom: tablas → tarjetas, filas horizontales → apiladas, header → columna.
// Se hace en JS (no sólo CSS) porque varios casos cambian la ESTRUCTURA del
// DOM, no sólo estilos. Breakpoint por defecto 768px, que es donde Strapi ya
// colapsa su barra lateral a hamburguesa.
export function useIsMobile(maxWidth = 768): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [isMobile, setIsMobile] = React.useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );
  React.useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return isMobile;
}
