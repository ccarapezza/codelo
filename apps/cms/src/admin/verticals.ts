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

/**
 * Se mergea con la `config` del panel: logo, tema y textos del login.
 *
 * Vacío = el panel queda con el violeta y el logo de Strapi. Para cambiarlo:
 * `{ auth: { logo }, menu: { logo }, theme: { light: { colors }, dark: { colors } },
 * translations: { es: { "Auth.form.welcome.title": "…" } } }`.
 */
export const adminConfig = {};

/**
 * Tarjetas propias en la home del panel.
 *
 * ⚠️ El motor deja en la home SÓLO los widgets de esta lista: filtra los del
 * content-manager para que la home sea del proyecto. Con la lista vacía, la
 * home del panel queda sin tarjetas.
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
 * `agent-action`: Postgres respalda el enum con un CHECK.
 */
export const agentRoles: Array<{
  value: string;
  label: string;
  badgeVariant: string;
  description?: string;
}> = [];
