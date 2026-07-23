"use client";

import { useState } from "react";
import { SplashEstampa } from "./SplashEstampa";

/* Splash real: corre en CADA carga completa, recargas incluidas. Las
   navegaciones internas no lo repiten porque el layout no se re-monta.

   Sin compuertas de estado: el overlay se renderiza también en SSR, así el
   PRIMER paint ya es la hoja de papel opaca tapando el sitio — nada se ve
   antes del splash. Las cruces de registro y el rótulo son animaciones CSS
   puras (corren aun sin JS); la coreografía por fases y el humo arrancan al
   hidratar, y la pasada final de racleta revela la página. */

export function SiteSplash() {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return <SplashEstampa onDone={() => setShow(false)} />;
}
