// Las claves de los ajustes del SITIO que el panel puede escribir.
//
// Viven en un módulo sin dependencias —y no dentro del controller— para que
// puedan compararse contra el schema.json en un test: importar el controller
// arrastra @strapi/core entero, que no carga fuera del servidor.
//
// Los ajustes EDITORIALES son otra lista: ENGINE_PROMPT_KEYS en prompt-defaults.ts.

export const ENGINE_SETTING_KEYS = [
  "openaiTextModel",
  "openaiImageModel",
  /** Traducir cada nota al publicarla. Apagado, una instancia monolingüe no paga esos tokens. */
  "autoTranslate",
  "adsensePublisherId",
  "adsenseSidebarLeftSlot",
  "adsenseSidebarRightSlot",
  "adsenseHomeInFeedSlot",
  "adsenseMobileBannerSlot",
  "adsenseInArticleSlot",
  "googleAnalyticsId",
  "googleSiteVerification",
  "clarityProjectId",
  "houseAdsEnabled",
  /**
   * Cuántos días hacia atrás se ingieren noticias — y cuánto se conservan.
   * Estaba fijo en 7 dentro del código, y con eso un feed que publica una nota
   * por mes no aportaba nunca sin que hubiera forma de cambiarlo.
   */
  "ingestWindowDays",
  /**
   * Etiqueta para las notas creadas a mano cuando el editor no elige ninguna.
   * Las de los agentes llevan la suya (`agent.defaultTag`); sin esto, las del
   * editor salían sin sección y no aparecían en ninguna portada temática.
   */
  "defaultPostTagSlug",
  /**
   * Identidad visual de las placas. Se derivan de BRAND_COLOR_KEYS, que es la
   * fuente de verdad: el test de contrato compara las dos listas contra el
   * schema.json para que no se pueda agregar un color en un lado solo.
   */
  "brandBg",
  "brandTitle",
  "brandBody",
  "brandMuted",
  "brandAccent",
  "brandAccentLight",
  "brandAccentDeep",
] as const;

/**
 * El logo de las placas, aparte porque NO es texto: es una relación de media.
 *
 * El controller lo guarda como id y el resto de los ajustes como string, así
 * que meterlo en la lista de arriba lo convertiría en la cadena "42".
 */
export const MEDIA_SETTING_KEY = "brandLogo";

/** Los que se guardan como booleano y no como texto. */
export const BOOLEAN_SETTING_KEYS = new Set<string>(["autoTranslate", "houseAdsEnabled"]);

/**
 * Los que se guardan como entero.
 *
 * Sin esto el controller los pasa por `String(value)` y el campo queda con la
 * cadena "30" en una columna integer: Postgres la acepta por casteo, pero el
 * valor que vuelve al panel ya no es el que se guardó.
 */
export const NUMBER_SETTING_KEYS = new Set<string>(["ingestWindowDays"]);
