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
import { catalogoConPrefijo } from "./i18n";
import mensajesEs from "./translations/es.json";
import mensajesEn from "./translations/en.json";

// La escala NEUTRA: el gris con el que se pinta todo lo que no es acento —el
// fondo de la página, las tarjetas, los bordes, el texto—. Es la que define de
// qué color "se siente" el panel, mucho más que el acento: Strapi la tiene con
// matiz violeta (240°, el mismo de su primario) y por eso un panel con sólo el
// acento cambiado seguía leyéndose como Strapi.
//
// Acá el matiz es 194° —azul-verde, tinta muy diluida—, quince grados más frío
// que el acento pavo real para que el acento siga separándose del fondo en vez
// de fundirse con él.
//
// ⚠️ Cada tono se derivó resolviendo la LUMINANCIA RELATIVA del tono de Strapi,
// no su claridad HSL: los doce pares de contraste del panel (texto sobre
// tarjeta, texto sobre página, atenuado, placeholder, borde, separador, en los
// dos temas) quedan dentro de 0.05 de los de Strapi. Si se retoca la escala a
// ojo eso se pierde y hay que reauditar los doce, no sólo mirar si "se ve
// bien".
//
// El tema oscuro de Strapi no tiene escala propia: REMAPEA estos mismos doce
// valores (su `neutral0` es el `neutral900` del claro, y así). Por eso alcanza
// con una sola escala para los dos temas.
const TINTA = {
  n0: "#ffffff",
  n100: "#f4f7f7",
  n150: "#e8ebec",
  n200: "#d8dedf",
  n300: "#b9c3c6",
  n400: "#9ba9ae",
  n500: "#819399",
  n600: "#5b6c71",
  n700: "#405054",
  n800: "#2a373a",
  n900: "#1b2427",
  n1000: "#141a1c",
};

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
  neutral0: TINTA.n0,
  neutral100: TINTA.n100,
  neutral150: TINTA.n150,
  neutral200: TINTA.n200,
  neutral300: TINTA.n300,
  neutral400: TINTA.n400,
  neutral500: TINTA.n500,
  neutral600: TINTA.n600,
  neutral700: TINTA.n700,
  neutral800: TINTA.n800,
  neutral900: TINTA.n900,
  neutral1000: TINTA.n1000,
};
const COLORS_DARK = {
  primary100: "#0a2422",
  primary200: "#17514b",
  primary500: "#2bafa3",
  primary600: "#3bc2b5",
  primary700: "#3bc2b5",
  buttonPrimary500: "#12857c",
  buttonPrimary600: "#0f6e68",
  // El remapeo del tema oscuro, con los mismos tonos dados vuelta: `neutral0`
  // es el fondo de la tarjeta (el más claro de los oscuros) y `neutral800` en
  // adelante son el texto. No es un error que 400 y 600 compartan tono ni que
  // 800/900/1000 sean los tres blancos: así está en Strapi y respetarlo es lo
  // que mantiene los contrastes.
  neutral0: TINTA.n900,
  neutral100: TINTA.n1000,
  neutral150: TINTA.n800,
  neutral200: TINTA.n700,
  neutral300: TINTA.n600,
  neutral400: TINTA.n400,
  neutral500: TINTA.n300,
  neutral600: TINTA.n400,
  neutral700: TINTA.n150,
  neutral800: TINTA.n0,
  neutral900: TINTA.n0,
  neutral1000: TINTA.n0,
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
  // Los textos del panel, más los del login.
  //
  // El nombre de la marca es el mismo en los dos idiomas —es un nombre propio—
  // pero el subtítulo no: se traduce como cualquier otra cadena. Van acá y no
  // en los catálogos porque son identidad, y un proyecto los pisa desde su
  // costura sin tocar el resto de los mensajes (mergeAdminConfig mergea por
  // locale y clave por clave).
  translations: {
    en: {
      ...catalogoConPrefijo(mensajesEn),
      "Auth.form.welcome.title": "Nib",
      "Auth.form.welcome.subtitle": "Agent-run newsroom · built on Strapi",
    },
    es: {
      ...catalogoConPrefijo(mensajesEs),
      "Auth.form.welcome.title": "Nib",
      "Auth.form.welcome.subtitle": "Redacción con agentes · construido sobre Strapi",
    },
  },
};
