// Datos para la home del admin (widgets de sistema/crons). Sólo lectura.
//
// Auth: requireAdmin (cualquier usuario logueado del panel: admin, editor o
// author). A propósito NO usa requireAdminPermission — la idea es que editores
// y autores entiendan de dónde y cuándo sale la información, sin poder tocarla.
import { requireAdmin } from "../../../lib/admin-auth";
import { DEFAULT_BO_TERMS } from "../../../lib/boletin-oficial";

// Traduce las reglas de cron que realmente usamos (config/cron-tasks.ts) a una
// frase legible. Sólo cubre esos patrones; cualquier otro se muestra crudo, en
// vez de arriesgar una interpretación equivocada.
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
function describeCron(rule: string | undefined): string | null {
  if (!rule) return null;
  const hhmm = (m: string, h: string) => `${h.padStart(2, "0")}:${m.padStart(2, "0")}`;
  let mm: RegExpMatchArray | null;
  if ((mm = rule.match(/^\*\/(\d+) \* \* \* \*$/))) return `cada ${mm[1]} minutos`;
  if (rule === "* * * * *") return "cada minuto";
  if ((mm = rule.match(/^(\d+) (\d+) \* \* \*$/))) return `todos los días a las ${hhmm(mm[1], mm[2])}`;
  if ((mm = rule.match(/^(\d+) (\d+) \* \* (\d)$/)))
    return `cada ${DIAS[+mm[3]] ?? "semana"} a las ${hhmm(mm[1], mm[2])}`;
  if ((mm = rule.match(/^(\d+) (\d+) \*\/(\d+) \* \*$/)))
    return `cada ${mm[3]} días a las ${hhmm(mm[1], mm[2])}`;
  return rule;
}

function cronInfo(strapi: any, taskName: string) {
  const rule = strapi.config.get(`server.cron.tasks.${taskName}.options.rule`) as string | undefined;
  const tz = strapi.config.get(`server.cron.tasks.${taskName}.options.tz`) as string | undefined;
  return {
    enabled: Boolean(strapi.config.get("server.cron.enabled")),
    rule: rule ?? null,
    label: describeCron(rule),
    tz: tz ?? null,
  };
}

export default ({ strapi }: { strapi: any }) => ({
  // ── Boletín Oficial ──────────────────────────────────────────────────────
  async boletin(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    // Las normas del Boletín se guardan en news-context con source
    // "Boletín Oficial" (o "Boletín Oficial · <rubro>").
    const items = await strapi.db.query("api::news-context.news-context").findMany({
      where: { source: { $startsWith: "Boletín Oficial" } },
      orderBy: { itemPublishedAt: "desc" },
      limit: 8,
      select: ["title", "url", "source", "itemPublishedAt", "fetchedAt"],
    });
    const total = await strapi.db
      .query("api::news-context.news-context")
      .count({ where: { source: { $startsWith: "Boletín Oficial" } } });

    ctx.body = {
      cron: cronInfo(strapi, "boletinOficial"),
      terms: DEFAULT_BO_TERMS,
      // Ventana de días hacia atrás que barre cada corrida (ver cron-tasks.ts).
      sinceDays: 7,
      total,
      items,
    };
  },

  // ── INASE (cultivares + operadores RNCyFS) ───────────────────────────────
  async inase(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;

    const cultivaresCount = await strapi.db.query("api::cultivar.cultivar").count();
    const operadoresCount = await strapi.db.query("api::operador-semilla.operador-semilla").count();

    // "Última actualización" = fila más reciente por updatedAt. Es cuándo
    // CAMBIÓ el espejo, no necesariamente la última corrida del cron (una
    // corrida sin novedades no mueve updatedAt). Se rotula así en la UI.
    const lastCultivar = await strapi.db.query("api::cultivar.cultivar").findOne({
      orderBy: { updatedAt: "desc" },
      select: ["updatedAt"],
    });
    const lastOperador = await strapi.db.query("api::operador-semilla.operador-semilla").findOne({
      orderBy: { updatedAt: "desc" },
      select: ["updatedAt"],
    });

    ctx.body = {
      cultivares: {
        count: cultivaresCount,
        lastUpdate: lastCultivar?.updatedAt ?? null,
        cron: cronInfo(strapi, "inaseCultivares"),
      },
      operadores: {
        count: operadoresCount,
        lastUpdate: lastOperador?.updatedAt ?? null,
        cron: cronInfo(strapi, "inaseOperadores"),
      },
    };
  },
});
