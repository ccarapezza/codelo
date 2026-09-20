// Lo que ESTE proyecto suma al sitemap.
//
// Es una COSTURA: app/sitemap.ts es del motor y arma las entradas —alternates
// de idioma, prioridades, fail-soft— sin saber qué rutas existen acá. Un
// proyecto sin páginas propias deja esto como está.

/** Rutas estáticas propias, sin el prefijo de idioma. Ej: "/quienes-somos". */
export const VERTICAL_STATIC_PATHS: string[] = [];

/**
 * Rutas dinámicas propias: las fichas de un catálogo, un espejo de registros,
 * lo que el proyecto publique. El motor las envuelve con su fail-soft, así que
 * puede fallar sin tirar el sitemap entero.
 */
export async function extraSitemapPaths(): Promise<string[]> {
  return [];
}
