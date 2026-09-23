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
//
// El @usuario de redes NO está acá: es `socialHandle`, un ajuste editable desde
// el panel. Estaba en los dos lados y podían decir cosas distintas — la placa
// firmaba de una forma y el caption de otra.

// Los valores son los de Nib: una sola tinta a distintas profundidades. Los tres
// acentos no son tres colores sino el mismo pigmento más claro y más hondo, así
// que el gradiente FIRE sale como una aguada de tinta y no como un arcoíris. Un
// proyecto que adopta el motor reescribe este archivo entero con los suyos.
export const BRAND = {
  bg: "#0E1A1C",
  bgSoft: "#17282B",
  white: "#FFFFFF",
  offwhite: "#E6EDEC",
  muted: "#8AA0A1",
  accent: "#2BAFA3",
  accentLight: "#6FE0D4",
  accentWarm: "#1F4E63",
  fontDisplay: "Anton",
  fontBody: "Inter",
};

/** Gradiente de marca reutilizable. */
export const FIRE = `linear-gradient(95deg, ${BRAND.accentLight} 0%, ${BRAND.accent} 55%, ${BRAND.accentWarm} 100%)`;

/** Nombre del archivo dentro de lib/social-cards/assets/logo/. */
export const LOGO_FILE = "nib.png";
