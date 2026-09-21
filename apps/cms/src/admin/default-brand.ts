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

// Rampa ámbar, muestreada del logo (#F4B04A, la pluma) y extendida respetando
// la lógica de contraste de Strapi, que NO es simétrica entre temas:
//
//   · en claro,  primary600 es el fondo del botón y lleva texto blanco encima,
//     así que tiene que ser un ámbar QUEMADO. El de la marca da 1.88:1 contra
//     blanco —ilegible—; #9A6410 da 4.99:1 y pasa AA.
//   · en oscuro, primary600 es el tono que resalta contra el panel, así que ahí
//     sí va el ámbar de la marca: 8.4:1 contra el fondo del admin. Los botones
//     usan buttonPrimary600 (el quemado) para no perder el contraste del texto.
//
// Si se retoca la paleta, recalcular estos dos ratios antes de commitear: el
// error fácil es usar el ámbar lindo en los dos lados y dejar los botones del
// tema claro con texto blanco ilegible.
const COLORS_LIGHT = {
  primary100: "#fdf3e3",
  primary200: "#f6dcae",
  primary500: "#c98a2a",
  primary600: "#9a6410",
  primary700: "#7a4e0b",
  buttonPrimary500: "#c98a2a",
  buttonPrimary600: "#9a6410",
};
const COLORS_DARK = {
  primary100: "#2a1e0c",
  primary200: "#6b4e20",
  primary500: "#c98a2a",
  primary600: "#f4b04a",
  primary700: "#f4b04a",
  buttonPrimary500: "#c98a2a",
  buttonPrimary600: "#9a6410",
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
