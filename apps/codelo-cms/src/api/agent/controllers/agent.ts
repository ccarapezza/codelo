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

export default factories.createCoreController("api::agent.agent", ({ strapi }) => ({
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
