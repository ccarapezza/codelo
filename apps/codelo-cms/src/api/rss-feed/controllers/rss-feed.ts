import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { fetchAndSaveNews, getRssLastRun, validateFeed } from "../../../lib/rss-fetcher";

// Traduce las reglas de cron que usamos a algo legible. Sólo cubre los patrones
// que existen en config/cron-tasks.ts; cualquier otra cosa se muestra cruda en
// vez de inventarle una interpretación (una regla mal traducida en la UI es
// peor que la regla a secas).
function describeCronRule(rule: string): string {
  const everyNMinutes = rule.match(/^\*\/(\d+) \* \* \* \*$/);
  if (everyNMinutes) return `cada ${everyNMinutes[1]} minutos`;
  if (rule === "* * * * *") return "cada minuto";
  const dailyAt = rule.match(/^(\d+) (\d+) \* \* \*$/);
  if (dailyAt) return `todos los días a las ${dailyAt[2].padStart(2, "0")}:${dailyAt[1].padStart(2, "0")}`;
  return rule;
}

const UID = "api::rss-feed.rss-feed";

// Campos editables desde la pantalla. El resto (lastFetchedAt, lastError,
// lastItemCount) lo escribe sólo el fetcher: son estado observado, no
// configuración, y dejarlos entrar por el body permitiría "arreglar" un feed
// caído a mano sin que haya vuelto a andar.
type FeedInput = { name?: string; url?: string; enabled?: boolean };

/** Toma sólo los campos editables del body y los normaliza. */
function pickEditable(body: FeedInput): FeedInput {
  const data: FeedInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (typeof body.url === "string") data.url = body.url.trim();
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  return data;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // CRUD propio. Estos endpoints existen porque el content-type está oculto del
  // Content Manager (pluginOptions), y esa marca no sólo lo saca del menú: hace
  // que /content-manager/collection-types/... devuelva 403 incluso al super
  // admin, porque el tipo deja de registrarse en la matriz de permisos.
  async adminList(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    ctx.body = {
      results: await strapi.documents(UID).findMany({ sort: "name:asc", limit: 200 }),
    };
  },

  async adminCreate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { name, url, enabled } = pickEditable(ctx.request.body as FeedInput);
    if (!name || !url) return ctx.badRequest("name y url son obligatorios");
    ctx.body = await strapi.documents(UID).create({ data: { name, url, enabled: enabled ?? true } });
  },

  async adminUpdate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.params as { documentId: string };
    ctx.body = await strapi
      .documents(UID)
      .update({ documentId, data: pickEditable(ctx.request.body as FeedInput) });
  },

  async adminDelete(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.params as { documentId: string };
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { ok: true };
  },

  // Cadencia real de la ingesta, leída de la config del cron en vez de
  // hardcodeada en la página: si alguien cambia la regla en cron-tasks.ts, la
  // UI acompaña sola en lugar de mentir.
  async adminStatus(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const rule = strapi.config.get("server.cron.tasks.rssFetcher.options.rule") as
      | string
      | undefined;
    ctx.body = {
      // CRON_ENABLED=false apaga TODOS los crons: sin esto la página diría
      // "cada 30 minutos" en un entorno donde no corre nunca.
      cronEnabled: Boolean(strapi.config.get("server.cron.enabled")),
      rule: rule ?? null,
      label: rule ? describeCronRule(rule) : null,
      lastRunAt: await getRssLastRun(strapi),
    };
  },

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
