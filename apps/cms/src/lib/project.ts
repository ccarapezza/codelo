// Identidad de ESTA instalación del motor.
//
// Todo lo que abajo se lee de env es lo que cambia entre un proyecto y otro
// montado sobre el mismo código: el slug técnico, el nombre visible y la URL
// pública. Nada de esto puede quedar escrito en el código del motor, porque el
// mismo árbol corre en varios sitios.
//
// ⚠️ `PROJECT_SLUG` no tiene default en producción A PROPÓSITO. Con él se
// arman las claves del core store (`<slug>:i18n-posts-migrated`), y esa clave
// es lo único que impide que una migración de arranque vuelva a correr y
// re-estampe cada post al idioma por defecto. Un default silencioso haría que
// un proyecto mal configurado escribiera bajo la clave equivocada, encontrara
// la migración "sin correr" y pisara las traducciones. Mejor no arrancar.

function required(name: string, fallbackEnDev: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `[project] Falta ${name}. Es obligatoria en producción: con ella se arman ` +
        `las claves del core store, y una equivocada puede disparar migraciones ` +
        `de arranque que ya corrieron.`,
    );
  }
  return fallbackEnDev;
}

/** Slug técnico: containers, claves internas, nombre del cliente ante terceros. */
export const slug = required("PROJECT_SLUG", "codelo");

/** Nombre visible de la marca. El de la voz editorial vive en prompt-settings. */
export const name = required("PROJECT_NAME", "Cogollos del Oeste");

/** Origen público del sitio, para los headers que piden identificarse. */
export const siteUrl = (
  process.env.SITE_PUBLIC_URL?.trim() ||
  process.env.URL?.trim() ||
  "http://localhost:3200"
).replace(/\/$/, "");

/**
 * Clave del core store con el prefijo del proyecto.
 *
 * El prefijo tiene que seguir siendo el mismo que usaba el proyecto antes de
 * parametrizar esto: son filas que YA existen en la base y que marcan
 * migraciones cumplidas.
 */
export function coreStoreKey(key: string): string {
  return `${slug}:${key}`;
}

/**
 * User-Agent para pedir feeds. Se identifica y deja una URL de contacto, que es
 * lo que corresponde al leer sitios ajenos de forma automatizada.
 */
export const userAgent = `${name.replace(/\s+/g, "")}Bot/1.0 (RSS aggregator; +${siteUrl})`;

/** Cabeceras con las que OpenRouter atribuye el consumo a esta aplicación. */
export const openRouterHeaders = {
  "HTTP-Referer": siteUrl,
  "X-Title": `${slug}-cms`,
};
