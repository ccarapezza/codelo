import type { Core } from "@strapi/strapi";
import { runDueAgents } from "../src/lib/agent-runner";
import { fetchAndSaveNews } from "../src/lib/rss-fetcher";
import { fetchBoletinOficialIntoContext } from "../src/lib/boletin-oficial";
import { syncCultivares } from "../src/lib/inase/cultivares";
import { syncOperadores } from "../src/lib/inase/operadores";

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

  boletinOficial: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        const created = await fetchBoletinOficialIntoContext(strapi, { sinceDays: 7 });
        if (created > 0) {
          strapi.log.info(`[cron] boletinOficial: ${created} normas nuevas en news_context.`);
        }
      } catch (err) {
        // fetchBoletinOficialIntoContext ya falla suave por término; esto cubre
        // un fallo del lado de Strapi (p. ej. la escritura en news_context).
        strapi.log.error("[cron] boletinOficial failed:", err);
      }
    },
    options: {
      // Una vez por día, 07:15. Deliberadamente MUCHO menos frecuente que el
      // RSS: el Boletín publica una edición diaria (no hay nada nuevo entre
      // corridas) y el endpoint es una API interna no documentada de un sitio
      // público — no corresponde golpearlo seguido. La ventana de 7 días da
      // margen para recuperarse de varios días caídos sin perder normas.
      rule: "15 7 * * *",
      tz: "America/Argentina/Buenos_Aires",
    },
  },

  inaseOperadores: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        await syncOperadores(strapi);
      } catch (err) {
        // Falla suave: el espejo queda como estaba (viejo, pero coherente) y la
        // web sigue sirviendo. Nunca se vacía la tabla por un fallo de INASE.
        strapi.log.error("[cron] inaseOperadores failed:", err);
      }
    },
    options: {
      // Cada 2 días a las 05:40. El propio INASE declara que el padrón se
      // actualiza cada 48 h, así que correrlo más seguido es golpear al pedo.
      rule: "40 5 */2 * *",
      tz: "America/Argentina/Buenos_Aires",
    },
  },

  inaseCultivares: {
    task: async ({ strapi }: { strapi: Core.Strapi }) => {
      try {
        await syncCultivares(strapi);
      } catch (err) {
        strapi.log.error("[cron] inaseCultivares failed:", err);
      }
    },
    options: {
      // Semanal, domingos 06:00. Deliberadamente MUY espaciado: el catálogo no
      // tiene filtro server-side utilizable, así que cada corrida son ~149
      // requests paginados contra una API interna no documentada. Y el ritmo de
      // altas no lo justifica: 13 altas en 2022, 35 en 2023, 0 en 2024, 7 en
      // 2025, 1 en lo que va de 2026. A diario serían miles de requests por año
      // para descubrir una decena de cultivares.
      rule: "0 6 * * 0",
      tz: "America/Argentina/Buenos_Aires",
    },
  },
};
