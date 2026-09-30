// Lo que ESTE proyecto le agrega al panel del motor.
//
// Es una COSTURA: `src/admin/app.tsx` es del motor y consume este módulo sin
// saber qué hay adentro. Un proyecto sin agregados exporta las listas vacías y
// el panel queda con lo del motor y nada más.
//
// Acá va lo específico del vertical (widgets, pantallas y rutas propias, roles
// de agente extra, tarjetas de configuración propias) y también la identidad
// visual, que es específica por definición: logo, paleta y los textos de marca
// del login.

import * as React from "react";
import { Book, Cloud, Plant } from "@strapi/icons";
import type { StrapiApp } from "@strapi/strapi/admin";
import type { PromptCard, SettingCard } from "./seam-types";
import Logo from "./verticals/logo.png";

// Acento naranja "Cogollos del Oeste" en vez del de Nib, para distinguir este
// panel de otros. La rampa se derivó del naranja del logo (atardecer del
// isotipo) manteniendo la lógica de Strapi: en claro, primary600 es el tono
// oscuro de los botones (texto blanco, contraste AA ~4.5:1); en oscuro,
// primary600 es el tono claro que resalta sobre el fondo, y los botones usan
// buttonPrimary600 (el naranja quemado) para no perder contraste.
//
// Sólo se pisan los acentos: la escala neutra (fondos, bordes, texto) queda la
// del motor, porque el merge con default-brand.ts es clave por clave.
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

/**
 * Se mergea con la identidad por defecto del motor (src/admin/default-brand.ts):
 * logo, tema y textos del login. El merge es por clave y por locale.
 */
export const adminConfig = {
  auth: { logo: Logo },
  menu: { logo: Logo },
  // Sin esto la pestaña del panel mostraba la pluma de Nib: el favicon es
  // parte de la identidad por defecto del motor (default-brand.ts).
  head: { favicon: Logo },
  theme: {
    light: { colors: COLORS_LIGHT },
    dark: { colors: COLORS_DARK },
  },
  // Textos de marca en la pantalla de login (pisan las claves de Strapi). El
  // panel está en castellano e inglés, así que cada idioma lleva el suyo.
  translations: {
    en: {
      "Auth.form.welcome.title": `Welcome to ${MARCA}`,
      "Auth.form.welcome.subtitle": "The portal's admin panel",
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
 *
 * ⚠️ Si la lista tiene algo, el motor deja en la home SÓLO esos widgets (más
 * los suyos): filtra los del content-manager para que la home sea del proyecto.
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
export const menuLinks: Array<Parameters<StrapiApp["addMenuLink"]>[0]> = [];

/** Rutas propias sin entrada de menú. Este proyecto no agrega ninguna. */
export const routes: Array<{ path: string; Component: () => Promise<unknown> }> = [];

/**
 * Roles de agente que suma este vertical, para el selector y las etiquetas de
 * la auditoría. El runner vive en src/verticals/agent-roles.ts, y el valor
 * tiene que existir además en el enum de los schema.json de `agent` y
 * `agent-action`: no hay CHECK en Postgres, pero `strapi.documents()` valida
 * el enum y rechaza el alta de un agente con un rol que no esté ahí.
 */
export const agentRoles: Array<{
  value: string;
  label: string;
  badgeVariant: string;
  description?: string;
}> = [];

/**
 * Tarjetas propias en Configuración editorial (/admin/prompt-settings).
 *
 * El prompt del lector de normas del Boletín Oficial: es de un módulo propio,
 * no de la línea editorial del sitio. La clave está además en
 * `src/verticals/prompt-fields.ts` y en el schema.json de `prompt-setting`.
 * Las etiquetas van en castellano literal: `t()` las devuelve tal cual.
 */
export const promptCards: PromptCard[] = [
  {
    id: "boletin",
    title: "Boletín Oficial",
    description:
      "Cómo se lee una norma del Boletín: qué le interesa a la asociación, cómo se puntúa la relevancia y qué no se puede afirmar nunca. Lo usa el lector de normas, no los agentes de redacción.",
    accent: "warning",
    icon: React.createElement(Book),
    fields: [
      {
        key: "boletinAnalysisInstructions",
        // En castellano, como la ficha que produce: no es un campo "en inglés".
        lang: "salida",
        label: "Instrucciones de lectura de normas",
        hint: "Las reglas duras de la ficha (no interpretar, no calcular plazos, no aconsejar) están acá. Si se tocan, re-probar el lector contra normas reales.",
        rows: 16,
        reference:
          "Sos un analista que lee normas del Boletín Oficial de la República Argentina para una asociación civil, y produce una ficha de lectura para el público general.\n\n{esto}\n\nDevolvé JSON ESTRICTO con exactamente esta forma: { \"relevancia\": …, \"resumen\": …, \"queCambia\": …, … }",
      },
    ],
  },
];

/**
 * Tarjetas propias en Sitio e integraciones (/admin/site-settings).
 *
 * El modelo del lector de normas (verticals/norma-model.ts). La clave está
 * además en `src/verticals/setting-fields.ts` y en el schema.json de
 * `site-setting`.
 */
export const settingCards: SettingCard[] = [
  {
    id: "normas",
    title: "Lectura de normas",
    description:
      "El modelo con el que se leen las normas del Boletín Oficial. Son resoluciones largas y con anexos: conviene poder subir de modelo sin encarecer la generación de notas.",
    accent: "warning",
    icon: React.createElement(Book),
    fields: [
      {
        key: "openaiNormaModel",
        kind: "text-model",
        label: "Modelo de análisis normativo",
        hint: "Vacío usa el modelo de texto (o OPENAI_NORMA_MODEL si está en el entorno).",
      },
    ],
  },
];
