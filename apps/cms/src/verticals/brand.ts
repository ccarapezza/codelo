// Identidad de marca para las placas de redes.
//
// Es una COSTURA: el motor (lib/social-cards) compone las placas sin saber de
// qué color son. Los TAMAÑOS son del motor —los define Instagram, no la marca—
// y no se tocan.
//
// ⚠️ CONTRATO: el motor consume estas claves por ROL, no por color. Todas son
// obligatorias; si falta una, el typecheck lo dice. Nombrarlas por rol y no por
// tono ("accent", no "green") es lo que permite que un proyecto naranja y uno
// verde usen las mismas plantillas.
//
//   bg / bgSoft     fondo de la placa y su variante suave
//   white / offwhite / muted   la escala de texto sobre ese fondo
//   accent          color primario de marca
//   accentLight     variante clara, para números y destacados sobre el fondo
//   accentWarm      acento secundario, para llamados a la acción
//   fontDisplay / fontBody     titulares y cuerpo
//   handle          el dominio o usuario que se imprime en la placa de cierre

// Los valores son los de Nib: grafito y ámbar, muestreados del logo. Un
// proyecto que adopta el motor reescribe este archivo entero con los suyos.
export const BRAND = {
  bg: "#1B1B1F",
  bgSoft: "#26262B",
  white: "#FFFFFF",
  offwhite: "#EDEDED",
  muted: "#9A9AA2",
  accent: "#F4B04A",
  accentLight: "#F9CF8F",
  accentWarm: "#C2661A",
  fontDisplay: "Anton",
  fontBody: "Inter",
  handle: "nib",
};

/** Gradiente de marca reutilizable. */
export const FIRE = `linear-gradient(95deg, ${BRAND.accentLight} 0%, ${BRAND.accent} 55%, ${BRAND.accentWarm} 100%)`;

/** Nombre del archivo dentro de lib/social-cards/assets/logo/. */
export const LOGO_FILE = "nib.png";
