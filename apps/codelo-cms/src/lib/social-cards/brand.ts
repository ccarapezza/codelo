// Sistema de marca de Fulbo Studio (colores, tipografías, tamaños).
// Tomado del logo: negro verdoso, fuego naranja->rojo, azul de los arcos.
export const BRAND = {
  bg: "#0C110F", // fondo casi negro (combina con el icon-512)
  bgSoft: "#141B18",
  white: "#FFFFFF",
  offwhite: "#E9ECEA",
  muted: "#8B938F",
  orange: "#FF7A00", // naranja principal
  flame: "#FFB02E", // ámbar (números grandes)
  red: "#E5392F", // rojo de la estela
  blue: "#3A6FF7", // azul de los arcos
  fontDisplay: "Anton", // titulares y números (condensada pesada)
  fontBody: "Inter", // cuerpo y etiquetas
  handle: "cogollosdeloeste",
};

// Gradiente de fuego reutilizable (estela del logo).
export const FIRE = `linear-gradient(95deg, ${BRAND.flame} 0%, ${BRAND.orange} 45%, ${BRAND.red} 100%)`;

export interface Size {
  width: number;
  height: number;
}

export const SIZES: Record<"portrait" | "square" | "story", Size> = {
  portrait: { width: 1080, height: 1350 }, // feed vertical (recomendado IG)
  square: { width: 1080, height: 1080 }, // feed cuadrado
  story: { width: 1080, height: 1920 }, // stories / reels cover
};
