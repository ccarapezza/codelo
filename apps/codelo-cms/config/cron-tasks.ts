import type { Core } from "@strapi/strapi";
import { runDueAgents } from "../src/lib/agent-runner";
import { fetchAndSaveNews } from "../src/lib/rss-fetcher";

export default {
  agentScheduler: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        await runDueAgents(strapi);
      } catch (err) {
        strapi.log.error("[cron] agentScheduler failed:", err);
      }
    },
    options: {
      rule: "* * * * *",
      tz: "America/Argentina/Buenos_Aires",
    },
  },

  rssFetcher: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        await fetchAndSaveNews(strapi);
      } catch (err) {
        strapi.log.error("[cron] rssFetcher failed:", err);
      }
    },
    options: {
      // Cada 30 minutos. Mantiene news_context fresco para los redactores y
      // distribuye la carga durante el día. Cada fetch es liviano (HTTP GET +
      // parse XML); la dedup por URL evita inserts duplicados.
      rule: "*/30 * * * *",
      tz: "America/Argentina/Buenos_Aires",
    },
  },
};
