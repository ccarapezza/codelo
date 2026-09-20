// Identidad de marca para las placas de redes.
//
// Es una COSTURA: el motor (lib/social-cards) compone las placas sin saber de
// qué color son. Acá viven los colores, las tipografías, el handle y el archivo
// del logo; los TAMAÑOS y la maquetación son del motor y no se tocan.

// Sistema de marca de Cogollos del Oeste (colores, tipografías, tamaños).
// Alineado con la dirección Organic Biophilic de la web: verde bosque como
// color de marca, terracota como acento de CTA, fondo verde casi negro.
// Ver apps/web/design-system/ y app/[lang]/globals.css.
export const BRAND = {
  bg: "#0B1710", // verde casi negro (mismo que el dark mode de la web)
  bgSoft: "#14251B",
  white: "#FFFFFF",
  offwhite: "#E7F2E9",
  muted: "#8CA694",
  green: "#15803D", // verde bosque — color primario de marca
  greenLight: "#4ADE80", // verde claro para números/destacados sobre fondo oscuro
  terracotta: "#C2410C", // acento cálido (CTA)
  earth: "#8B5E34", // tierra, acento secundario
  fontDisplay: "Anton", // titulares (condensada pesada)
  fontBody: "Inter", // cuerpo y etiquetas
  handle: "cogollosdeloeste",
};

// Gradiente de marca reutilizable (verde bosque -> verde claro).
export const FIRE = `linear-gradient(95deg, ${BRAND.greenLight} 0%, ${BRAND.green} 55%, ${BRAND.earth} 100%)`;

/** Nombre del archivo dentro de lib/social-cards/assets/logo/. */
export const LOGO_FILE = "cogollosdeloeste.png";
