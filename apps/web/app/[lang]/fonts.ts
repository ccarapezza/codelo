// Tipografía de ESTE sitio.
//
// Es una COSTURA: el layout del motor importa `fontClassNames` y no sabe qué
// fuentes son. Lo que SÍ es del contrato son las cuatro variables CSS que
// expone, porque theme.css y las utilidades de Tailwind las consumen por
// nombre:
//   · --font-wordmark  el nombre del sitio (y nada más)
//   · --font-display   titulares
//   · --font-serif     cuerpo de texto
//   · --font-mono      etiquetas, fechas, metadata
//
// La base usa una sola familia para los cuatro roles: legible y sin opinión.
// Darle personalidad al sitio empieza por acá.

import { Inter, IBM_Plex_Mono } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-sans-base" });
const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

/** Lo que el layout pone en <body> para que las variables estén disponibles. */
export const fontClassNames = [inter.variable, mono.variable, "nib-fonts"].join(" ");
