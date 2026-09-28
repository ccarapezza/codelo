// Lo que ESTE proyecto le agrega al panel del motor.
//
// Es una COSTURA: `src/admin/app.tsx` es del motor y consume este módulo sin
// saber qué hay adentro. Un proyecto sin agregados deja todo vacío, como está
// ahora, y el panel queda con lo del motor y nada más.
//
// Acá va lo específico del vertical (widgets de la home, pantallas y rutas
// propias, roles de agente extra) y también la identidad visual, que es
// específica por definición: logo, paleta y los textos de marca del login.

import type { StrapiApp } from "@strapi/strapi/admin";
import type { PromptCard, SettingCard } from "./seam-types";

/**
 * Se mergea con la identidad por defecto del motor (src/admin/default-brand.ts):
 * logo, tema y textos del login.
 *
 * Vacío = el panel queda con la marca de Nib (pluma ámbar sobre grafito), NO
 * con el violeta de Strapi. Para pisarla:
 * `{ auth: { logo }, menu: { logo }, head: { favicon }, theme: { light: { colors },
 * dark: { colors } }, translations: { es: { "Auth.form.welcome.title": "…" } } }`.
 *
 * El merge es por clave y por locale, así que alcanza con declarar lo que se
 * quiere cambiar: definir sólo `theme.light` no borra el tema oscuro del motor,
 * y traducir una clave del login no borra las demás.
 */
export const adminConfig = {};

/**
 * Tarjetas propias en la home del panel.
 *
 * ⚠️ Si la lista tiene algo, el motor deja en la home SÓLO esos widgets: filtra
 * los del content-manager para que la home sea del proyecto. Si está vacía no
 * filtra nada y quedan las tarjetas nativas de Strapi — dejar la home en blanco
 * es peor que mostrarlas.
 */
export const widgets: Array<{
  icon: unknown;
  title: { id: string; defaultMessage: string };
  id: string;
  component: () => Promise<unknown>;
}> = [];

/** Entradas propias en el menú lateral, después de las del motor. */
export const menuLinks: Array<Parameters<StrapiApp["addMenuLink"]>[0]> = [];

/** Rutas propias sin entrada de menú (se entra por un enlace desde otra pantalla). */
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
 * Para los prompts que sólo tienen sentido en este proyecto: el de un módulo
 * propio, no la línea editorial del sitio (esa son campos del motor y ya tienen
 * su tarjeta). Cada campo necesita además su clave en
 * `src/verticals/prompt-fields.ts` y su atributo en el schema.json de
 * `prompt-setting`, o el controller lo descarta.
 */
export const promptCards: PromptCard[] = [];

/**
 * Tarjetas propias en Sitio e integraciones (/admin/site-settings).
 *
 * Mismo trato: la clave va además en `src/verticals/setting-fields.ts` y el
 * atributo en el schema.json de `site-setting`.
 */
export const settingCards: SettingCard[] = [];
