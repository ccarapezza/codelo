// Identidad de ESTA instalación del motor.
//
// Todo lo que se lee de env acá es lo que cambia entre un proyecto y otro
// montado sobre el mismo código: el slug técnico, el nombre visible y la URL
// pública. Nada de esto puede quedar escrito en el código del motor, porque el
// mismo árbol corre en varios sitios.
//
// ⚠️ Nada de este módulo LANZA al cargarse, y es deliberado: `strapi build`
// carga config/ (y con ella media aplicación) sin el env de runtime, así que
// una validación en el cuerpo del módulo rompe el build de la imagen. La
// exigencia real vive en dos lugares mejores: `:?required` en el compose, que
// no deja ni levantar el container, y la guardia de src/index.ts justo antes de
// la migración que sí es peligrosa.

/** Valor por defecto para desarrollo; en producción lo impone el compose. */
const SLUG_POR_DEFECTO = "nib";

/** true si el slug vino de la configuración y no del default de desarrollo. */
export const slugExplicito = Boolean(process.env.PROJECT_SLUG?.trim());

/** Slug técnico: containers, claves internas, nombre del cliente ante terceros. */
export const slug = process.env.PROJECT_SLUG?.trim() || SLUG_POR_DEFECTO;

/** Nombre visible de la marca. El de la voz editorial vive en prompt-settings. */
export const name = process.env.PROJECT_NAME?.trim() || "Nib";

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
 * migraciones cumplidas. Cambiarlo equivale a decir "ninguna migración corrió".
 */
/**
 * Idioma en el que escribe el sitio y al que se traduce.
 *
 * Son CÓDIGOS de locale (es, en, pt-BR), no los nombres que ven los prompts:
 * esos son `writingLanguage` y `translationLanguage`, que se editan desde el
 * panel. Van por env y no por ajuste porque Strapi los usa para crear y publicar
 * localizaciones: cambiarlos con contenido cargado exige una migración, no un
 * click.
 */
export const defaultLocale = process.env.DEFAULT_LOCALE?.trim() || "es";
export const translationLocale = process.env.TRANSLATION_LOCALE?.trim() || "en";

/** Zona horaria de los schedules y de los crons del motor. */
export const scheduleTz = process.env.AGENT_SCHEDULE_TZ?.trim() || "America/Argentina/Buenos_Aires";

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
