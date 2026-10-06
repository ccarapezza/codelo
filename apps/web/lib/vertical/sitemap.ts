// Lo que ESTE proyecto suma al sitemap.
//
// Es una COSTURA: app/sitemap.ts es del motor y arma las entradas —alternates
// de idioma, prioridades, fail-soft— sin saber qué rutas existen acá. Un
// proyecto sin páginas propias exporta una lista vacía y una función que
// devuelve nada.

import { ANIOS } from "./copa-cata";
import { getCultivares } from "./semillas";

/** Rutas estáticas propias, sin el prefijo de idioma. */
export const VERTICAL_STATIC_PATHS = [
  "/quienes-somos",
  "/reprocann",
  "/normativa",
  "/actividades",
  "/contacto",
  "/clima",
  "/semillas",
  "/semillas/operadores",
  "/semillas/rotulo",
  "/semillas/leer",
  "/copa-cata",
  "/copa-cata/palmares",
];

/**
 * Rutas dinámicas propias.
 *
 * Acá: la ficha de cada edición de la Copa Cata —salen de datos versionados,
 * no del CMS, así que van primero y no dependen de que el CMS responda— y la
 * de cada cultivar del espejo de INASE. Las fichas de cultivar son páginas de
 * registro público que vale indexar —la gente busca por nombre de variedad—
 * y el espejo se refresca semanal, de ahí la baja frecuencia de cambio que
 * les pone el motor.
 */
export async function extraSitemapPaths(): Promise<string[]> {
  const copa = ANIOS.map((anio) => `/copa-cata/${anio}`);
  const cultivares = await getCultivares();
  return [...copa, ...cultivares.map((c) => `/semillas/${c.numeroRegistro}`)];
}
