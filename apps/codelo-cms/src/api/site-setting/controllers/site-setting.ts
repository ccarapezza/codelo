import { factories } from "@strapi/strapi";
import { requireAdminPermission } from "../../../lib/admin-auth";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";

export default factories.createCoreController(
  "api::site-setting.site-setting",
  ({ strapi }) => ({
    async adminFind(ctx) {
      if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
      const setting = await strapi.db
        .query("api::site-setting.site-setting")
        .findOne({});
      ctx.body = setting ?? {};
    },

    async adminUpdate(ctx) {
      if (!(await requireAdminPermission(ctx, strapi, ADMIN_PERMISSIONS.siteSettings))) return;
      const body = ctx.request.body as Record<string, unknown>;
      const existing = await strapi.db
        .query("api::site-setting.site-setting")
        .findOne({});
      if (existing) {
        ctx.body = await strapi.db
          .query("api::site-setting.site-setting")
          .update({ where: { id: (existing as { id: number }).id }, data: body });
      } else {
        ctx.body = await strapi.db
          .query("api::site-setting.site-setting")
          .create({ data: body });
      }
    },
  }),
);
