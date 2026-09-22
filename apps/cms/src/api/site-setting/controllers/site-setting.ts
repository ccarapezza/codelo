import { factories } from "@strapi/strapi";
import { requireAdminPermission } from "../../../lib/admin-auth";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import { verticalSettingKeys } from "../../../verticals/setting-fields";
import { BOOLEAN_SETTING_KEYS, ENGINE_SETTING_KEYS } from "../../../lib/setting-keys";

const UID = "api::site-setting.site-setting";


export default factories.createCoreController(UID, ({ strapi }) => ({
  async adminFind(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
    const setting = await strapi.db.query(UID).findOne({});
    ctx.body = setting ?? {};
  },

  async adminUpdate(ctx) {
    if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
    const body = ctx.request.body as Record<string, unknown>;

    const permitidas = new Set<string>([...ENGINE_SETTING_KEYS, ...verticalSettingKeys]);
    const desconocidas = Object.keys(body).filter((k) => !permitidas.has(k));
    if (desconocidas.length > 0) {
      return ctx.badRequest(`Campos desconocidos: ${desconocidas.join(", ")}`);
    }

    const data: Record<string, unknown> = {};
    for (const key of permitidas) {
      if (!(key in body)) continue;
      const value = body[key];
      data[key] = BOOLEAN_SETTING_KEYS.has(key)
        ? Boolean(value)
        : typeof value === "string"
          ? value
          : value == null
            ? null
            : String(value);
    }

    const existing = (await strapi.db.query(UID).findOne({})) as { id: number } | null;
    ctx.body = existing
      ? await strapi.db.query(UID).update({ where: { id: existing.id }, data })
      : await strapi.db.query(UID).create({ data });
  },
}));
