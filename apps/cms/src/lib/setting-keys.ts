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
