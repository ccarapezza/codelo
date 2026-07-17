import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { DEFAULT_PROMPT_SETTINGS } from "../../../lib/prompt-defaults";

const UID = "api::prompt-setting.prompt-setting";

// Only these fields are user-editable; anything else in the request body
// (id, timestamps, …) is ignored so the admin form can't write arbitrary columns.
const ALLOWED_FIELDS = [
  "domainDescription",
  "writingLanguage",
  "fabricationProneFacts",
  "analysisModeFraming",
  "bodyStructureGuide",
  "imageSystemInstructions",
  "imageThemeGuide",
  "imageAnchorTaxonomy",
] as const;

export default factories.createCoreController(UID, ({ strapi }) => ({
  // Returns both the saved row (may be empty before the first save) and the
  // code defaults, so the admin page can populate empty fields and offer a
  // "restore defaults" action without a second request.
  async adminFind(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const current = await strapi.db.query(UID).findOne({});
    ctx.body = { current: current ?? {}, defaults: DEFAULT_PROMPT_SETTINGS };
  },

  async adminUpdate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
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
