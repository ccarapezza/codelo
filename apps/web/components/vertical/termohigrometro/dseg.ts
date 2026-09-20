import localFont from "next/font/local";

/**
 * DSEG7 Classic — la tipografía de siete segmentos de keshikan
 * (https://github.com/keshikan/DSEG), SIL OFL 1.1. La licencia va al lado del
 * .woff2 en fonts/, como exige la OFL; no borrar una sin la otra.
 *
 * Se empaqueta en vez de usar un CDN porque son 5 KB y el CSP del sitio no
 * deja pedir fuentes a terceros.
 *
 * Variante Classic y no Modern/MINI: es el LCD de aparato barato, que es
 * justamente el registro del termohigrómetro. Recta y no Italic: la itálica es
 * el reloj despertador y le da un aire ochentoso que pelea con Dos Tintas.
 */
export const dseg = localFont({
  src: "./fonts/DSEG7Classic-Regular.woff2",
  variable: "--font-dseg",
  display: "swap",
  // Sin métricas de fallback ajustadas: no existe un sustituto razonable de
  // una fuente de siete segmentos, y el ajuste automático deforma el layout.
  adjustFontFallback: false,
});
