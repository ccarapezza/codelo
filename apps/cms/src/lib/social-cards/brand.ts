// La marca de las placas: colores por ROL, tipografías y logo.
//
// Los TAMAÑOS son del motor —los define Instagram, no la marca— y no se tocan.
// Los COLORES viven en la base (`site-setting`) y se editan desde el panel:
// Sitio e integraciones → Identidad visual. Antes estaban en código, en la
// costura del vertical, así que una instancia nueva salía con el fondo y el
// acento de Nib hasta que alguien editara TypeScript y reconstruyera la imagen.
//
// Lo que SÍ sigue en la costura son las tipografías, y no por comodidad: son
// archivos. `fontDisplay`/`fontBody` tienen que nombrar una familia que satori
// haya cargado de `assets/fonts/` — nombrar una que no está no da error, dibuja
// con otra. El logo sí se sube desde el panel; el de la costura es el que se
// usa mientras no haya ninguno subido.

import { BRAND_FONTS } from "../../verticals/brand";

export interface Size {
  width: number;
  height: number;
}

export const SIZES: Record<"portrait" | "square" | "story", Size> = {
  portrait: { width: 1080, height: 1350 }, // feed vertical (recomendado IG)
  square: { width: 1080, height: 1080 }, // feed cuadrado
  story: { width: 1080, height: 1920 }, // stories / reels cover
};

/**
 * Los colores de la placa, nombrados por el papel que cumplen.
 *
 * Nombrarlos por rol y no por tono es lo que permite que un proyecto naranja y
 * uno verde usen las mismas plantillas. El nombre anterior de `accentDeep` era
 * `accentWarm`, y era falso: el de Nib es `#1F4E63`, un azul frío.
 *
 * `title`/`body`/`muted` no son tres tonos del mismo rol sino tres NIVELES de
 * texto —titular, cuerpo, pie— y cada uno se usa en sus propios lugares.
 */
export interface BrandColors {
  /** Fondo de la placa sin imagen. De acá salen también el velo sobre la foto y el degradé de los overlays de video. */
  bg: string;
  /** Titulares. El de mayor contraste. */
  title: string;
  /** Cuerpo, bajadas y citas. */
  body: string;
  /** Pie, atribución y etiquetas. */
  muted: string;
  /** Acento principal. Centro del degradé de marca. */
  accent: string;
  /** Variante clara: TODO acento que sea texto —los números grandes, la comilla, la url— va acá. */
  accentLight: string;
  /**
   * Variante profunda: el cierre del degradé y los velos de color.
   *
   * ⚠️ Nunca como texto. Las plantillas `stat` y `countdown` la usaban para su
   * número de 460px —herencia del prototipo, donde este slot era un naranja
   * brillante— y con el azul profundo de Nib eso daba 1.97:1 sobre su propio
   * fondo: un número gigante que casi no se veía. Es un color pensado para ir
   * por debajo de algo, no encima.
   */
  accentDeep: string;
}

export interface Brand extends BrandColors {
  fontDisplay: string;
  fontBody: string;
}

/**
 * Los colores por defecto del motor: los de Nib.
 *
 * Una instancia que no configuró nada sale con esto, igual que sale con el
 * nombre "Nib" y el texto editorial neutro. No es la identidad de nadie más.
 */
export const NEUTRAL_BRAND_COLORS: BrandColors = {
  bg: "#0E1A1C",
  title: "#FFFFFF",
  body: "#E6EDEC",
  muted: "#8AA0A1",
  accent: "#2BAFA3",
  accentLight: "#6FE0D4",
  accentDeep: "#1F4E63",
};

/** Las claves de color, en el orden en que se muestran en el panel. */
export const BRAND_COLOR_KEYS = [
  "bg",
  "title",
  "body",
  "muted",
  "accent",
  "accentLight",
  "accentDeep",
] as const satisfies readonly (keyof BrandColors)[];

/** La clave en `site-setting` que guarda cada color. `bg` → `brandBg`. */
export function settingKeyForColor(key: keyof BrandColors): string {
  return `brand${key[0].toUpperCase()}${key.slice(1)}`;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Arma la marca a partir de una fila de `site-setting`.
 *
 * Un color vacío —o escrito mal— cae al del motor en vez de romper el render:
 * una placa con un color de menos se publica igual, una excepción en mitad de
 * la tanda no. La validación estricta va en el panel, que es donde se le puede
 * avisar a alguien a tiempo.
 */
export function resolveBrand(row: Record<string, unknown> | null | undefined): Brand {
  const colors = { ...NEUTRAL_BRAND_COLORS };
  for (const key of BRAND_COLOR_KEYS) {
    const raw = row?.[settingKeyForColor(key)];
    if (typeof raw === "string" && HEX.test(raw.trim())) colors[key] = raw.trim().toUpperCase();
  }
  return { ...colors, ...BRAND_FONTS };
}

/** Degradé de marca: el acento a tres profundidades, de claro a hondo. */
export function fireGradient(brand: BrandColors): string {
  return `linear-gradient(95deg, ${brand.accentLight} 0%, ${brand.accent} 55%, ${brand.accentDeep} 100%)`;
}

/**
 * Un color de la marca con alfa, para componer velos.
 *
 * Los velos estaban escritos a mano como `rgba(8,11,9,…)` —un casi negro con
 * verde, muestreado de la marca del prototipo del que se portó el módulo—, así
 * que una marca clara recibía un velo que le peleaba al fondo. Ahora salen del
 * color elegido.
 */
export function rgba(hex: string, alpha: number): string {
  const m = HEX.test(hex) ? hex : NEUTRAL_BRAND_COLORS.bg;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(m.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
