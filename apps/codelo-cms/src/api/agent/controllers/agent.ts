import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { runAgentNow, runRedactor } from "../../../lib/agent-runner";
import { planBatch, type AgentSlot } from "../../../lib/batch-orchestrator";
import { getOpenAITextKey } from "../../../lib/openai-config";

interface BatchRequestSlot {
  documentId: string;
  notesCount: number;
}

async function loadAgentSlots(
  strapi: any,
  slots: BatchRequestSlot[],
): Promise<AgentSlot[]> {
  const out: AgentSlot[] = [];
  for (const s of slots) {
    const agent = (await strapi.documents("api::agent.agent").findOne({
      documentId: s.documentId,
    })) as { documentId: string; name: string; role: string; enabled: boolean } | null;
    if (!agent) throw new Error(`Agent not found: ${s.documentId}`);
    if (agent.role !== "redactor")
      throw new Error(`Batch only supports redactor role; "${agent.name}" is "${agent.role}".`);
    if (!agent.enabled) throw new Error(`Agent "${agent.name}" is disabled.`);
    out.push({ documentId: agent.documentId, name: agent.name, notesCount: s.notesCount });
  }
  return out;
}

const UID = "api::agent.agent";

type ScheduleInput = {
  id?: number;
  days?: string[];
  time?: string;
  timezone?: string | null;
  notesCount?: number;
  enabled?: boolean;
};

type AgentInput = {
  name?: string;
  role?: "director" | "redactor" | "image-generator";
  instructions?: string | null;
  topic?: string | null;
  requireNewsContext?: boolean;
  enabled?: boolean;
  schedules?: ScheduleInput[];
  imagePromptTemplate?: string | null;
  imageSize?: string | null;
  imageQuality?: string | null;
};

// Los tipos que Strapi genera para `.create()/.update()` modelan el shape de
// LECTURA: no admiten null, aunque mandar null es exactamente como se limpia un
// campo opcional (la pantalla manda `instructions: null` para el generador de
// imágenes, y `topic: null` para director). Lo que garantiza que no entre
// basura es la whitelist de pickEditable(), no el tipo — de ahí el cast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDocumentData(data: AgentInput): any {
  return data;
}

// Whitelist de lo editable desde la pantalla. Deja afuera `lastRunAt` (lo
// escribe el runner) y `posts` (relación inversa): son estado, no configuración.
function pickEditable(body: AgentInput): AgentInput {
  const data: AgentInput = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (body.role) data.role = body.role;
  if ("instructions" in body) data.instructions = body.instructions ?? null;
  if ("topic" in body) data.topic = body.topic ?? null;
  if (typeof body.requireNewsContext === "boolean") data.requireNewsContext = body.requireNewsContext;
  if (typeof body.enabled === "boolean") data.enabled = body.enabled;
  if ("imagePromptTemplate" in body) data.imagePromptTemplate = body.imagePromptTemplate ?? null;
  if ("imageSize" in body) data.imageSize = body.imageSize ?? null;
  if ("imageQuality" in body) data.imageQuality = body.imageQuality ?? null;
  // Los schedules son un componente repetible: se reemplaza la lista entera,
  // que es como venía tratándolos el Content Manager. `lastRunAt` de cada
  // schedule NO se toca acá; lo administra el runner.
  if (Array.isArray(body.schedules)) {
    data.schedules = body.schedules.map((s) => ({
      ...(s.id ? { id: s.id } : {}),
      days: Array.isArray(s.days) ? s.days : [],
      time: s.time ?? "",
      timezone: s.timezone ?? null,
      notesCount: typeof s.notesCount === "number" ? s.notesCount : 1,
      enabled: s.enabled !== false,
    }));
  }
  return data;
}

export default factories.createCoreController(UID, ({ strapi }) => ({
  // CRUD propio: el content-type está oculto del Content Manager, y esa marca
  // hace que /content-manager/collection-types/... responda 403 hasta al super
  // admin (el tipo deja de existir en la matriz de permisos).
  async adminList(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    ctx.body = {
      results: await strapi.documents(UID).findMany({
        sort: ["role:asc", "name:asc"],
        populate: ["schedules"],
        limit: 100,
      }),
    };
  },

  async adminCreate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const data = pickEditable(ctx.request.body as AgentInput);
    if (!data.name) return ctx.badRequest("name es obligatorio");
    if (!data.role) return ctx.badRequest("role es obligatorio");
    // `enabled` es required en el schema, así que en el alta hay que resolverlo.
    ctx.body = await strapi.documents(UID).create({
      data: toDocumentData({ ...data, enabled: data.enabled ?? true }),
      populate: ["schedules"],
    });
  },

  async adminUpdate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.params as { documentId: string };
    ctx.body = await strapi.documents(UID).update({
      documentId,
      data: toDocumentData(pickEditable(ctx.request.body as AgentInput)),
      populate: ["schedules"],
    });
  },

  async adminDelete(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.params as { documentId: string };
    await strapi.documents(UID).delete({ documentId });
    ctx.body = { ok: true };
  },

  async runNow(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId, notesCount } = ctx.request.body as {
      documentId: string;
      notesCount?: number;
    };
    if (!documentId) return ctx.badRequest("documentId is required");
    // Fire-and-forget: respond immediately so the client doesn't timeout
    runAgentNow(strapi, documentId, notesCount ?? 1).catch((err: unknown) => {
      strapi.log.error(`[agent] runNow failed for ${documentId}:`, err);
    });
    ctx.body = { ok: true };
  },

  // Dry-run the batch planner: returns the assignment without dispatching.
  // Useful for the UI to preview "who covers what" before spending OpenAI quota.
  async previewBatch(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { slots } = ctx.request.body as { slots?: BatchRequestSlot[] };
    if (!slots || slots.length === 0) return ctx.badRequest("slots[] is required");
    try {
      const agentSlots = await loadAgentSlots(strapi, slots);
      const plan = await planBatch(strapi, agentSlots);
      ctx.body = plan;
    } catch (err) {
      ctx.badRequest((err as Error).message);
    }
  },

  // Plan + dispatch redactors with deterministic item assignments. Fire-and-
  // forget per the same convention as runNow.
  async runBatch(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { slots } = ctx.request.body as { slots?: BatchRequestSlot[] };
    if (!slots || slots.length === 0) return ctx.badRequest("slots[] is required");

    let agentSlots: AgentSlot[];
    try {
      agentSlots = await loadAgentSlots(strapi, slots);
    } catch (err) {
      return ctx.badRequest((err as Error).message);
    }

    try {
      getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }

    const plan = await planBatch(strapi, agentSlots);
    strapi.log.info(
      `[agent] batch plan: pool=${plan.poolSize} dupes_skipped=${plan.skippedDupes} ` +
        `requested=${plan.requested} assigned=${plan.assigned}`,
    );

    // Dispatch each redactor in parallel with its assigned items.
    for (const assignment of plan.assignments) {
      if (assignment.items.length === 0) {
        strapi.log.warn(
          `[agent] batch: "${assignment.agentName}" got 0 items; skipping.`,
        );
        continue;
      }
      const agent = (await strapi.documents("api::agent.agent").findOne({
        documentId: assignment.agentDocumentId,
      })) as any;
      // Fire-and-forget per agent
      runRedactor(strapi, agent, assignment.items.length, assignment.items)
        .then(() =>
          strapi.documents("api::agent.agent").update({
            documentId: assignment.agentDocumentId,
            data: { lastRunAt: new Date().toISOString() } as any,
          }),
        )
        .catch((err) =>
          strapi.log.error(
            `[agent] batch dispatch failed for ${assignment.agentName}:`,
            err,
          ),
        );
    }

    ctx.body = { ok: true, plan };
  },

  async getImageGenerator(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const results = await strapi.documents("api::agent.agent").findMany({
      filters: { role: "image-generator", enabled: true },
    });
    if (!results.length) return ctx.notFound("No image-generator agent configured.");
    ctx.body = { data: results[0] };
  },
}));
