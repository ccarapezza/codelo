// Append-only audit log helper for AI agent actions. Every persistent
// action a Director / Redactor / Image-Generator agent performs should
// fire a log entry through here so the admin Audit page can reconstruct
// what happened and when.
//
// IMPORTANT: this MUST never block or fail the action it audits. If the
// log row can't be written we swallow the error and emit a warn log so
// the original agent flow always succeeds.

import type { Core } from "@strapi/strapi";

const UID = "api::agent-action.agent-action";

export type AgentRole = "director" | "redactor" | "image-generator" | "analyst" | "system";

export type AgentAction =
  | "draft_created"
  | "draft_published"
  | "draft_rejected"
  | "cover_generated"
  | "cover_failed"
  | "cover_manual"
  | "carousel_manual"
  | "carousel_failed"
  | "batch_dispatched"
  | "post_translated"
  | "translation_failed"
  | "agent_failed"
  | "director_idle"
  | "studio_portada"
  | "studio_carrusel"
  | "studio_historia"
  | "studio_reel"
  | "studio_failed";

export interface LogAgentActionInput {
  agentRole: AgentRole;
  action: AgentAction;
  summary: string;
  agentName?: string | null;
  agentDocumentId?: string | null;
  postDocumentId?: string | null;
  postTitle?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function logAgentAction(
  strapi: Core.Strapi,
  input: LogAgentActionInput,
): Promise<void> {
  try {
    await strapi.db.query(UID).create({
      data: {
        agentRole: input.agentRole,
        action: input.action,
        summary: input.summary,
        agentName: input.agentName ?? null,
        agentDocumentId: input.agentDocumentId ?? null,
        postDocumentId: input.postDocumentId ?? null,
        postTitle: input.postTitle ?? null,
        metadata: input.metadata ?? null,
      },
    });
  } catch (err) {
    strapi.log.warn(`[audit] failed to log "${input.action}": ${(err as Error).message}`);
  }
}
