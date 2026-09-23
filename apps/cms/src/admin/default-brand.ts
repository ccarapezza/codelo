// Identidad por defecto del panel: la de Nib.
//
// Es el FALLBACK del motor, no la identidad final de un proyecto. `app.tsx` la
// mergea con `verticals.adminConfig` (la costura) y ahí el proyecto pisa lo que
// quiera: un portal que define su logo y su paleta queda con los suyos, y uno
// que no define nada queda con los de Nib en vez de con el violeta de Strapi.
//
// El archivo se llama por su ROL y no por la marca —"el brand por defecto"—
// porque baja a los proyectos como archivo del motor: allá no es "lo de Nib",
// es "lo que hay si no defino nada".
//
// Sobre Strapi: el panel se pinta con los colores de Nib pero no esconde sobre
// qué corre. El subtítulo del login lo dice, la pantalla Settings → Application
// con la versión de Strapi queda intacta y el título accesible del nav sigue
// siendo el de Strapi. Cambiar la piel no es lo mismo que cambiar la firma.

import Mark from "./brand/mark.png";
import Favicon from "./brand/favicon.png";

// Rampa "pavo real", el acento de Nib. La paleta es una sola tinta a distintas
// profundidades: grafito con fondo verde-azulado, y el acento saliendo de esa
// misma superficie en vez de pegado encima.
//
// ⚠️ El primario NO puede ser ámbar ni naranja: el `warning600` de Strapi es
// #d9822f y convivimos con él en la misma pantalla. El ámbar que tenía Nib
// estaba a SIETE grados de matiz de ese warning — en una UI densa, "esto está
// activo" y "cuidado" se veían casi igual. El teal queda a 147°.
//
// El contraste tampoco es simétrico entre temas:
//
//   · en claro,  primary600 es el fondo del botón y lleva texto blanco encima:
//     #0F6E68 da 6.09:1 y pasa AA con margen.
//   · en oscuro, primary600 es el tono que resalta contra el panel, así que va
//     el claro: #3BC2B5 da 7.99:1. Los botones usan buttonPrimary600 (el
//     profundo) para no perder el contraste del texto.
//
// Si se retoca la paleta, recalcular esos dos ratios Y la separación de matiz
// contra el warning antes de commitear.
const COLORS_LIGHT = {
  primary100: "#e3f2f0",
  primary200: "#b9e0db",
  primary500: "#12857c",
  primary600: "#0f6e68",
  primary700: "#0c5a55",
  buttonPrimary500: "#12857c",
  buttonPrimary600: "#0f6e68",
};
const COLORS_DARK = {
  primary100: "#0a2422",
  primary200: "#17514b",
  primary500: "#2bafa3",
  primary600: "#3bc2b5",
  primary700: "#3bc2b5",
  buttonPrimary500: "#12857c",
  buttonPrimary600: "#0f6e68",
};

// Los dos slots llevan el tile cuadrado, no el lockup:
//
//   · en el nav, porque lo encaja en 2.4rem con object-fit: contain y un logo
//     apaisado entraría diminuto;
//   · en el login, porque Strapi dibuja el logo y DEBAJO el título; con el
//     lockup la pantalla decía "nib" dos veces, una en la imagen y otra en
//     texto.
//
// El lockup (pluma + "nib") sí se usa en las placas de redes, que no tienen
// título aparte — ver lib/social-cards/assets/logo/.
export const DEFAULT_ADMIN_CONFIG = {
  auth: { logo: Mark },
  menu: { logo: Mark },
  head: { favicon: Favicon },
  theme: {
    light: { colors: COLORS_LIGHT },
    dark: { colors: COLORS_DARK },
  },
  // Se ponen en en+es para que el login diga lo mismo sea cual sea el idioma
  // del panel.
  translations: {
    en: {
      "Auth.form.welcome.title": "Nib",
      "Auth.form.welcome.subtitle": "Redacción con agentes · construido sobre Strapi",
    },
    es: {
      "Auth.form.welcome.title": "Nib",
      "Auth.form.welcome.subtitle": "Redacción con agentes · construido sobre Strapi",
    },
  },
};
