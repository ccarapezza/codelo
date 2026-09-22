import { factories } from "@strapi/strapi";
import { requireAdminPermission } from "../../../lib/admin-auth";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import { DEFAULT_PROMPT_SETTINGS, ENGINE_PROMPT_KEYS } from "../../../lib/prompt-defaults";
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
    ctx.body = { current: current ?? {}, defaults: DEFAULT_PROMPT_SETTINGS };
  },

  async adminUpdate(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.promptSettings))) return;
    const body = ctx.request.body as Record<string, unknown>;

    const data: Record<string, unknown> = {};
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
