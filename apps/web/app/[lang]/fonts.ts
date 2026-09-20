// Tipografía de ESTE sitio.
//
// Es una COSTURA: el layout del motor importa `fontClassNames` y no sabe qué
// fuentes son. Las variables CSS que exponen (--font-wordmark, --font-display,
// --font-serif, --font-mono) sí son del contrato: theme.css y las utilidades de
// Tailwind las consumen por ese nombre.

import { Big_Shoulders, IBM_Plex_Mono, Literata, Zilla_Slab } from "next/font/google";

// Dirección "Dos Tintas". Tres roles bien separados:
//  · marca    → Big Shoulders: condensada industrial. Se usa SOLO en el
//               nombre de la asociación (cabecera y pie). Toda la audacia
//               tipográfica se gasta ahí y el resto queda disciplinado.
//  · display  → Zilla Slab: egipcia, del mundo de la imprenta, para titulares.
//               Elegida sobre un serif de alto contraste a propósito: ese es
//               uno de los tres "looks por defecto" del diseño generado por IA.
//  · lectura  → Literata: diseñada para leer largo en pantalla.
//  · etiqueta → IBM Plex Mono: metadata, secciones y fechas. El mono da el
//               registro de ficha/laboratorio que pide el temario (etnobotánica,
//               relevamiento normativo) y separa el dato del relato.
const bigShoulders = Big_Shoulders({
  variable: "--font-wordmark",
  subsets: ["latin"],
  display: "swap",
});

const zillaSlab = Zilla_Slab({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

/** Lo que el layout pone en <body> para que las variables estén disponibles. */
export const fontClassNames = [
  bigShoulders.variable,
  zillaSlab.variable,
  literata.variable,
  plexMono.variable,
].join(" ");
