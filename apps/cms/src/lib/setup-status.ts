// Qué le falta a esta instancia para producir una nota.
//
// El motor puede estar impecable y el sitio no publicar nada porque falta un
// Director, o porque no hay ninguna fuente habilitada. Eso antes sólo se
// descubría corriendo un agente y mirando por qué no pasó nada. Esto lo dice de
// frente, en la home del panel.
//
// Cada chequeo dice además DÓNDE se arregla: el widget enlaza a la pantalla y,
// cuando corresponde, a la tarjeta exacta.

import type { Core } from "@strapi/strapi";
import { NEUTRAL_PROMPT_SETTINGS } from "./prompt-defaults";

export type SetupStatus = "ok" | "warn" | "missing";

export interface SetupCheck {
  id: string;
  label: string;
  status: SetupStatus;
  /** Sin esto los agentes NO pueden escribir. Lo demás es calidad. */
  blocking: boolean;
  detail?: string;
  /** Ruta del panel donde se resuelve. */
  to?: string;
}

export interface SetupReport {
  /** No falta nada bloqueante. */
  ready: boolean;
  checks: SetupCheck[];
  lastRssRun: string | null;
  lastAgentRun: string | null;
  publishedPosts: number;
}

const PROMPTS = "/prompt-settings";
const AGENTES = "/ai-agents";
const FUENTES = "/rss-feeds";
const AJUSTES = "/site-settings";

async function contar(strapi: Core.Strapi, uid: string, filters: object): Promise<number> {
  try {
    return await strapi.db.query(uid).count({ where: filters });
  } catch {
    return 0;
  }
}

export async function getSetupStatus(strapi: Core.Strapi): Promise<SetupReport> {
  const checks: SetupCheck[] = [];

  // ── Claves y modelos ──
  const hayClave = Boolean(process.env.OPENAI_API_KEY?.trim());
  checks.push({
    id: "openai-key",
    label: "Clave de OpenAI",
    status: hayClave ? "ok" : "missing",
    blocking: true,
    detail: hayClave ? undefined : "Falta OPENAI_API_KEY en el entorno del CMS. Sin esto no se genera nada.",
  });

  // ── Configuración editorial ──
  let prompt: Record<string, unknown> = {};
  try {
    prompt =
      ((await strapi.db
        .query("api::prompt-setting.prompt-setting")
        .findOne({})) as Record<string, unknown>) ?? {};
  } catch {
    prompt = {};
  }
  const valor = (k: string): string => String(prompt[k] ?? "").trim();

  // Un campo vacío usa el default neutro del motor, así que el sitio "funciona"
  // pero escribe como un portal genérico llamado Nib. Eso no es un error de
  // configuración: es exactamente lo que hay que cambiar primero.
  const marca = valor("brandName");
  checks.push({
    id: "brand-name",
    label: "Nombre de la marca",
    status: marca && marca !== NEUTRAL_PROMPT_SETTINGS.brandName ? "ok" : "missing",
    blocking: true,
    detail: marca
      ? marca === NEUTRAL_PROMPT_SETTINGS.brandName
        ? `Sigue siendo "${NEUTRAL_PROMPT_SETTINGS.brandName}": las notas y las placas se firman así.`
        : undefined
      : "Sin esto las notas se firman con el nombre por defecto del motor.",
    to: `${PROMPTS}#identidad`,
  });

  const dominio = valor("domainDescription");
  checks.push({
    id: "domain",
    label: "De qué habla el sitio",
    status: dominio && dominio !== NEUTRAL_PROMPT_SETTINGS.domainDescription ? "ok" : "missing",
    blocking: true,
    detail:
      dominio && dominio !== NEUTRAL_PROMPT_SETTINGS.domainDescription
        ? undefined
        : "Es lo primero que leen el redactor, el Director y el traductor. Con el valor por defecto escriben sobre cualquier cosa.",
    to: `${PROMPTS}#identidad`,
  });

  const cuerpo = valor("bodyStructureGuide");
  checks.push({
    id: "body-guide",
    label: "Voz y formato del cuerpo",
    status: cuerpo && cuerpo !== NEUTRAL_PROMPT_SETTINGS.bodyStructureGuide ? "ok" : "warn",
    blocking: false,
    detail:
      cuerpo && cuerpo !== NEUTRAL_PROMPT_SETTINGS.bodyStructureGuide
        ? undefined
        : "Con el formato genérico las notas salen correctas pero sin voz propia.",
    to: `${PROMPTS}#linea-editorial`,
  });

  // ── Agentes ──
  const redactores = await contar(strapi, "api::agent.agent", { role: "redactor", enabled: true });
  checks.push({
    id: "redactors",
    label: "Redactores activos",
    status: redactores > 0 ? "ok" : "missing",
    blocking: true,
    detail: redactores > 0 ? `${redactores} activo(s)` : "Nadie escribe las notas.",
    to: AGENTES,
  });

  const directores = await contar(strapi, "api::agent.agent", { role: "director", enabled: true });
  checks.push({
    id: "director",
    label: "Director activo",
    status: directores > 0 ? "ok" : "missing",
    blocking: true,
    detail:
      directores > 0
        ? undefined
        : "Sin Director los borradores se acumulan sin revisar: nadie los publica.",
    to: AGENTES,
  });

  const generadores = await contar(strapi, "api::agent.agent", {
    role: "image-generator",
    enabled: true,
  });
  checks.push({
    id: "image-generator",
    label: "Generador de portadas",
    status: generadores > 0 ? "ok" : "warn",
    blocking: false,
    detail: generadores > 0 ? undefined : "Las notas se publican sin imagen de portada.",
    to: AGENTES,
  });

  // ── Fuentes ──
  const feeds = await contar(strapi, "api::rss-feed.rss-feed", { enabled: true });
  checks.push({
    id: "feeds",
    label: "Fuentes RSS activas",
    status: feeds > 0 ? "ok" : "missing",
    blocking: true,
    detail:
      feeds > 0
        ? `${feeds} activa(s)`
        : "Sin fuentes no hay noticias que leer, y un redactor con `requireNewsContext` no escribe nada.",
    to: FUENTES,
  });

  const etiquetas = await contar(strapi, "api::tag.tag", {});
  checks.push({
    id: "tags",
    label: "Etiquetas",
    status: etiquetas > 0 ? "ok" : "warn",
    blocking: false,
    detail: etiquetas > 0 ? `${etiquetas} cargada(s)` : "Las notas se publican sin sección.",
    to: "/content-manager/collection-types/api::tag.tag",
  });

  // ── Últimas corridas ──
  const ultimo = async (uid: string, campo: string): Promise<string | null> => {
    try {
      const filas = (await strapi.db
        .query(uid)
        .findMany({ orderBy: { [campo]: "desc" }, limit: 1 })) as Array<Record<string, unknown>>;
      const v = filas[0]?.[campo];
      return v ? new Date(v as string).toISOString() : null;
    } catch {
      return null;
    }
  };

  const lastRssRun = await ultimo("api::rss-feed.rss-feed", "lastFetchedAt");
  const lastAgentRun = await ultimo("api::agent.agent", "lastRunAt");
  const publishedPosts = await contar(strapi, "api::post.post", { publishedAt: { $notNull: true } });

  checks.push({
    id: "first-run",
    label: "Primera corrida",
    status: publishedPosts > 0 ? "ok" : lastAgentRun ? "warn" : "warn",
    blocking: false,
    detail:
      publishedPosts > 0
        ? `${publishedPosts} nota(s) publicada(s)`
        : lastAgentRun
          ? "Algún agente ya corrió pero todavía no hay nada publicado. Mirá Auditoría para ver por qué."
          : "Todavía no corrió ningún agente. Probá «Correr ahora» en un redactor.",
    to: AGENTES,
  });

  return {
    ready: checks.every((c) => !c.blocking || c.status === "ok"),
    checks,
    lastRssRun,
    lastAgentRun,
    publishedPosts,
  };
}
