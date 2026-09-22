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
] as const;

/** Los que se guardan como booleano y no como texto. */
export const BOOLEAN_SETTING_KEYS = new Set<string>(["autoTranslate", "houseAdsEnabled"]);
