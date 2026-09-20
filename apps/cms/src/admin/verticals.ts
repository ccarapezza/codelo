// Lo que ESTE proyecto le agrega al panel del motor.
//
// Es una COSTURA: `src/admin/app.tsx` es del motor y consume este módulo sin
// saber qué hay adentro. Un proyecto sin agregados exporta las listas vacías y
// el panel queda con lo del motor y nada más.
//
// Acá va lo específico del vertical (widgets, pantallas y rutas propias, roles
// de agente extra) y también la identidad visual, que es específica por
// definición: logo, paleta y los textos de marca del login.

import { Book, Cloud, Plant } from "@strapi/icons";
import Logo from "./verticals/logo.png";

// Acento naranja "Cogollos del Oeste" en vez del violeta de Strapi, para
// distinguir este panel de otros. La rampa se derivó del naranja del logo
// (atardecer del isotipo) manteniendo la lógica de Strapi: en claro, primary600
// es el tono oscuro de los botones (texto blanco, contraste AA ~4.5:1); en
// oscuro, primary600 es el tono claro que resalta sobre el fondo, y los botones
// usan buttonPrimary600 (el naranja quemado) para no perder contraste.
const COLORS_LIGHT = {
  primary100: "#fdefe0",
  primary200: "#f8d6af",
  primary500: "#de7a22",
  primary600: "#bc5b0d",
  primary700: "#94480a",
  buttonPrimary500: "#de7a22",
  buttonPrimary600: "#bc5b0d",
};
const COLORS_DARK = {
  primary100: "#2a1b0d",
  primary200: "#6b4a28",
  primary500: "#bc5b0d",
  primary600: "#eb9a4e",
  primary700: "#eb9a4e",
  buttonPrimary500: "#de7a22",
  buttonPrimary600: "#bc5b0d",
};

const MARCA = "Cogollos del Oeste";

/** Se mergea con la `config` del panel: logo, tema y textos del login. */
export const adminConfig = {
  auth: { logo: Logo },
  menu: { logo: Logo },
  theme: {
    light: { colors: COLORS_LIGHT },
    dark: { colors: COLORS_DARK },
  },
  // Textos de marca en la pantalla de login (sobreescriben las claves i18n de
  // Strapi). Se ponen en en+es para que aparezcan sea cual sea el idioma del
  // panel.
  translations: {
    en: {
      "Auth.form.welcome.title": `Bienvenido a ${MARCA}`,
      "Auth.form.welcome.subtitle": "Panel de gestión del portal",
    },
    es: {
      "Auth.form.welcome.title": `Bienvenido a ${MARCA}`,
      "Auth.form.welcome.subtitle": "Panel de gestión del portal",
    },
  },
};

/**
 * Tarjetas propias en la home del panel.
 *
 * Informativas y de sólo lectura, para que TODO usuario —admin, editor o
 * author— entienda de dónde y cuándo sale la información. No llevan
 * `permissions`/`roles`, así que son visibles para todos.
 */
export const widgets = [
  {
    icon: Book,
    title: { id: "vertical.widget.boletin", defaultMessage: "Boletín Oficial" },
    id: "codelo-boletin",
    component: async () => (await import("./verticals/widgets/BoletinWidget")).default,
  },
  {
    icon: Cloud,
    title: {
      id: "vertical.widget.termohigrometro",
      defaultMessage: "Termohigrómetro (clima de cultivo)",
    },
    id: "codelo-termohigrometro",
    component: async () => (await import("./verticals/widgets/TermohigrometroWidget")).default,
  },
  {
    icon: Plant,
    title: { id: "vertical.widget.inase", defaultMessage: "INASE — cultivares y operadores" },
    id: "codelo-inase",
    component: async () => (await import("./verticals/widgets/InaseWidget")).default,
  },
];

/** Entradas propias en el menú lateral. Este proyecto no agrega ninguna. */
export const menuLinks: Array<Parameters<
  import("@strapi/strapi/admin").StrapiApp["addMenuLink"]
>[0]> = [];

/** Rutas propias sin entrada de menú. Este proyecto no agrega ninguna. */
export const routes: Array<{ path: string; Component: () => Promise<unknown> }> = [];

/**
 * Roles de agente que suma este vertical, para los selectores y las etiquetas
 * del panel. El runner correspondiente vive en src/verticals/agent-roles.ts, y
 * el valor tiene que existir además en el enum de los schema.json de `agent` y
 * `agent-action`: Postgres respalda el enum con un CHECK.
 */
export const agentRoles: Array<{
  value: string;
  label: string;
  badgeVariant: string;
  description?: string;
}> = [];
