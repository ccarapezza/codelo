import { factories } from "@strapi/strapi";
import { requireAdminPermission } from "../../../lib/admin-auth";
import { getOpenAITextKey, getOpenAITextModel } from "../../../lib/openai-config";
import { getOpenAIClient } from "../../../lib/openai";
import {
  translateFieldToEnglish,
  translateFieldsFromEnglish,
} from "../../../lib/translate-field";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import { DEFAULT_PROMPT_SETTINGS, ENGINE_PROMPT_KEYS } from "../../../lib/prompt-defaults";
import { NEUTRAL_PROMPT_DRAFTS } from "../../../lib/prompt-drafts";
import { verticalPromptKeys } from "../../../verticals/prompt-fields";

const UID = "api::prompt-setting.prompt-setting";

// Los campos que el panel puede escribir: los del motor más los que agregue el
// vertical. Sale de una sola fuente a propósito — cuando era una lista a mano se
// desincronizó en las dos direcciones: `brandName` estaba en el schema y no acá
// (nunca se podía guardar) y `boletinAnalysisInstructions` estaba acá y no en el
// schema (se guardaba en la nada, sin error). Cualquier otra clave del body
// (id, timestamps…) se ignora.
const ALLOWED_FIELDS: readonly string[] = [...ENGINE_PROMPT_KEYS, ...verticalPromptKeys];

export default factories.createCoreController(UID, ({ strapi }) => ({
  // Returns both the saved row (may be empty before the first save) and the
  // code defaults, so the admin page can populate empty fields and offer a
  // "restore defaults" action without a second request.
  async adminFind(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.promptSettings))) return;
    const current = await strapi.db.query(UID).findOne({});
    // `drafts` es la versión legible en castellano de los valores neutros. La
    // pantalla la usa cuando todavía no hay un borrador propio guardado.
    ctx.body = {
      current: current ?? {},
      defaults: DEFAULT_PROMPT_SETTINGS,
      drafts: NEUTRAL_PROMPT_DRAFTS,
    };
  },

  /**
   * Traduce al inglés lo que el usuario escribió en su idioma, para un campo de
   * instrucción. No guarda nada: devuelve la traducción para que se revise antes
   * de aceptarla.
   */
  async translateField(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.promptSettings))) return;
    const { text } = ctx.request.body as { text?: string };
    if (!text || !text.trim()) return ctx.badRequest("text es obligatorio");
    try {
      const client = getOpenAIClient(getOpenAITextKey());
      const model = await getOpenAITextModel(strapi);
      ctx.body = { translated: await translateFieldToEnglish(client, model, text) };
    } catch (err) {
      strapi.log.error("[prompt-setting] traducción falló:", err);
      return ctx.badRequest("No se pudo traducir. Revisá que OPENAI_API_KEY esté configurada.");
    }
  },

  /**
   * Traduce varios campos DEL inglés al idioma del usuario, para poder verlos y
   * editarlos en su idioma. No guarda nada: el resultado es un borrador que el
   * usuario decide si conserva.
   */
  async translateBack(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.promptSettings))) return;
    const { fields, language } = ctx.request.body as {
      fields?: Record<string, string>;
      language?: string;
    };
    if (!fields || Object.keys(fields).length === 0) return ctx.badRequest("fields es obligatorio");
    try {
      const client = getOpenAIClient(getOpenAITextKey());
      const model = await getOpenAITextModel(strapi);
      ctx.body = {
        translated: await translateFieldsFromEnglish(client, model, fields, language || "Spanish"),
      };
    } catch (err) {
      strapi.log.error("[prompt-setting] traducción inversa falló:", err);
      return ctx.badRequest("No se pudo traducir. Revisá que OPENAI_API_KEY esté configurada.");
    }
  },

  async adminUpdate(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.promptSettings))) return;
    const body = ctx.request.body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    // Los borradores en español. No son un campo de prompt: no se mandan a
    // ningún modelo, sólo se guardan para poder volver a editarlos. Van en una
    // columna JSON y no en 20 columnas paralelas.
    if ("sourceDrafts" in body && body.sourceDrafts && typeof body.sourceDrafts === "object") {
      data.sourceDrafts = body.sourceDrafts;
    }
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        const value = body[key];
        data[key] = typeof value === "string" ? value : value == null ? null : String(value);
      }
    }

    const existing = (await strapi.db.query(UID).findOne({})) as { id: number } | null;
    ctx.body = existing
      ? await strapi.db.query(UID).update({ where: { id: existing.id }, data })
      : await strapi.db.query(UID).create({ data });
  },
}));
