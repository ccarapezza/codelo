// Los tamaños son del motor: los define Instagram, no la marca. Los colores,
// tipografías y el logo vienen del vertical (ver src/verticals/brand.ts).
export { BRAND, FIRE, LOGO_FILE } from "../../verticals/brand";

export interface Size {
  width: number;
  height: number;
}

export const SIZES: Record<"portrait" | "square" | "story", Size> = {
  portrait: { width: 1080, height: 1350 }, // feed vertical (recomendado IG)
  square: { width: 1080, height: 1080 }, // feed cuadrado
  story: { width: 1080, height: 1920 }, // stories / reels cover
};
