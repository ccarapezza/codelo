import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { fetchAndSaveNews, validateFeed } from "../../../lib/rss-fetcher";

export default factories.createCoreController("api::rss-feed.rss-feed", ({ strapi }) => ({
  async fetchNow(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.request.body as { documentId?: string };
    // Fire-and-forget: respond immediately so the client doesn't timeout
    fetchAndSaveNews(strapi, documentId).catch((err: unknown) => {
      strapi.log.error(`[rss-fetcher] fetchNow failed:`, err);
    });
    ctx.body = { ok: true };
  },

  // Validate a feed URL without persisting anything. Used by the admin UI
  // "Verificar" button so the user can sanity-check a feed before saving it.
  async validate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { url } = ctx.request.body as { url?: string };
    if (!url) return ctx.badRequest("url is required");
    const result = await validateFeed(url);
    ctx.body = result;
  },
}));
