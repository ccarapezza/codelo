// Lo que ESTE proyecto suma al sitemap.
//
// Es una COSTURA: app/sitemap.ts es del motor y arma las entradas —alternates
// de idioma, prioridades, fail-soft— sin saber qué rutas existen acá. Un
// proyecto sin páginas propias exporta una lista vacía y una función que
// devuelve nada.

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
];

/**
 * Rutas dinámicas propias.
 *
 * Acá: la ficha de cada cultivar del espejo de INASE. Cada una es una página
 * de registro público que vale indexar —la gente busca por nombre de
 * variedad— y el espejo se refresca semanal, de ahí la baja frecuencia de
 * cambio que les pone el motor.
 */
export async function extraSitemapPaths(): Promise<string[]> {
  const cultivares = await getCultivares();
  return cultivares.map((c) => `/semillas/${c.numeroRegistro}`);
}
