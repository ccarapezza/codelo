// Identidad de marca para las placas de redes.
//
// Es una COSTURA: el motor (lib/social-cards) compone las placas sin saber de
// qué color son. Acá viven los colores, las tipografías, el handle y el archivo
// del logo; los TAMAÑOS son del motor —los define Instagram, no la marca— y no
// se tocan.

export const BRAND = {
  bg: "#111111",
  bgSoft: "#1C1C1C",
  white: "#FFFFFF",
  offwhite: "#EDEDED",
  muted: "#9A9A9A",
  green: "#2F6F4E",
  greenLight: "#63B98A",
  terracotta: "#B8542F",
  earth: "#7A5C3E",
  fontDisplay: "Anton",
  fontBody: "Inter",
  handle: "nib",
};

/** Gradiente de marca reutilizable. */
export const FIRE = `linear-gradient(95deg, ${BRAND.greenLight} 0%, ${BRAND.green} 55%, ${BRAND.earth} 100%)`;

/** Nombre del archivo dentro de lib/social-cards/assets/logo/. */
export const LOGO_FILE = "nib.png";
