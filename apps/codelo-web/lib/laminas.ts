// Láminas "dos tintas" de la casa: ilustraciones generadas con el mismo modelo
// de imagen que usa el CMS para portadas (Nano Banana vía OpenRouter), pedidas
// en las tintas de marca (tinta #00001C + sol #E4B569 sobre papel #F6E6CC) y
// versionadas en public/. Como el duotono y la banda del pie, son tratamientos
// de impresión: sus colores NO siguen al tema — en oscuro se ven como una
// lámina impresa, no como una superficie de interfaz.
export const LAMINAS = {
  hoja: "/illustrations/lamina-hoja.webp",
  semillas: "/illustrations/lamina-semillas.webp",
  tallo: "/illustrations/lamina-tallo.webp",
  sol: "/illustrations/lamina-sol.webp",
} as const;

export type LaminaId = keyof typeof LAMINAS;

// Variantes sobre fondo transparente, separadas de las láminas por tintas
// (máscara de tinta = déficit de canal rojo; máscara de ámbar = rojo−azul).
// Como el asset hereda el fondo del tema, hay dos bakes por lámina: `light`
// imprime la tinta azul-negra (para superficies claras) y `dark` la recolorea
// a papel (para superficies oscuras); el ámbar es constante en ambas. Se
// intercambian con `dark:hidden` / `dark:block`.
export const LAMINAS_TRANS: Record<LaminaId, { light: string; dark: string }> = {
  hoja: {
    light: "/illustrations/lamina-hoja-trans.webp",
    dark: "/illustrations/lamina-hoja-trans-dark.webp",
  },
  semillas: {
    light: "/illustrations/lamina-semillas-trans.webp",
    dark: "/illustrations/lamina-semillas-trans-dark.webp",
  },
  tallo: {
    light: "/illustrations/lamina-tallo-trans.webp",
    dark: "/illustrations/lamina-tallo-trans-dark.webp",
  },
  sol: {
    light: "/illustrations/lamina-sol-trans.webp",
    dark: "/illustrations/lamina-sol-trans-dark.webp",
  },
};

// Friso panorámico del oeste para la banda del pie, en dos bakes. Un solo par
// para ambos temas: el footer es tinta constante.
//   paper — techos en papel: el skyline se lee entero, silueta clara sobre tinta.
//   ink   — techos en la tinta original: sobre el fondo oscuro las siluetas se
//           funden y sólo quedan los detalles en ámbar, como un negativo. Es la
//           que usa el pie.
// El sol va chico y al extremo derecho a propósito: centrado competía con el
// sello circular del logo, que vive en la esquina izquierda de la banda.
// Al reemplazar el arte hay que cambiar el NOMBRE del archivo: el optimizador
// de next/image cachea por URL y siguió sirviendo el friso viejo durante todo
// un ciclo de revisión. Lo mismo valdría para el CDN en producción.
export const CIUDAD_FOOTER = {
  paper: "/illustrations/ciudad-oeste-paper.webp",
  ink: "/illustrations/ciudad-oeste-ink.webp",
} as const;

// Pool para fondos con texto encima (fallback de portadas). Excluye `sol`: su
// horizonte de tinta ocupa el borde inferior, justo donde va el título.
export const LAMINAS_FONDO: readonly LaminaId[] = ["hoja", "semillas", "tallo"];
