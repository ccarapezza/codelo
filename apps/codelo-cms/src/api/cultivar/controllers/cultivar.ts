import { factories } from "@strapi/strapi";
import { syncCultivares } from "../../../lib/inase/cultivares";
import { syncOperadores } from "../../../lib/inase/operadores";

/** Same shared-secret check the other internal endpoints use. */
function verifyInternalKey(ctx: any): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = ctx.request.headers["x-internal-key"];
  return typeof provided === "string" && provided === expected;
}

export default factories.createCoreController("api::cultivar.cultivar", ({ strapi }) => ({
  /**
   * Re-mirror the cannabis cultivars from the Catálogo Nacional.
   *
   * Takes ~6 minutes (149 paginated requests against an undocumented endpoint),
   * so callers should expect a long-running request. Unlike the cron, errors
   * surface as a 502 instead of being swallowed — that is the point of having a
   * manual trigger: you want to see what broke.
   */
  async syncFromInase(ctx: any) {
    if (!verifyInternalKey(ctx)) return ctx.unauthorized();
    try {
      ctx.body = await syncCultivares(strapi);
    } catch (err) {
      strapi.log.error("[inase/cultivares] sync manual falló:", err);
      ctx.status = 502;
      ctx.body = { error: (err as Error).message };
    }
  },

  /** Re-mirror the RNCyFS padrón. One request, a couple of seconds. */
  async syncOperadoresFromInase(ctx: any) {
    if (!verifyInternalKey(ctx)) return ctx.unauthorized();
    try {
      ctx.body = await syncOperadores(strapi);
    } catch (err) {
      strapi.log.error("[inase/operadores] sync manual falló:", err);
      ctx.status = 502;
      ctx.body = { error: (err as Error).message };
    }
  },
}));
