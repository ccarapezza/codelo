import type { Core } from "@strapi/strapi";
import { getRecentNewsForTopic, type NewsItem } from "./rss-fetcher";

// ---------------------------------------------------------------------------
// Deterministic assignment of news items to redactors.
// Goal: prevent two redactors from writing about the same subject, even when
// run in parallel. We dedupe by title similarity and then round-robin items
// to agents.
// ---------------------------------------------------------------------------

export interface AgentSlot {
  documentId: string;
  name: string;
  notesCount: number;
}

export interface BatchAssignment {
  agentDocumentId: string;
  agentName: string;
  items: NewsItem[];
}

export interface BatchPlan {
  assignments: BatchAssignment[];
  /** Items intentionally skipped because they duplicated a chosen subject. */
  skippedDupes: number;
  /** Total recent-news pool before dedup. */
  poolSize: number;
  /** Items requested vs items actually assigned. */
  requested: number;
  assigned: number;
}

// Jaccard similarity over significant words (length > 3) — fast, language-
// agnostic enough for ES/EN/PT. Returns 0..1. Exported so the redactor can reuse
// the exact same subject-clustering when hard-blocking duplicate posts at create
// time (see agent-runner).
export function titleSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // strip accents
        .split(/\W+/)
        .filter((w) => w.length > 3),
    );
  const sa = words(a);
  const sb = words(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  const intersection = [...sa].filter((w) => sb.has(w)).length;
  const union = new Set([...sa, ...sb]).size;
  return union > 0 ? intersection / union : 0;
}

// Keep only the first item from each "subject cluster". Threshold tuned so
// so that two write-ups of the same norm or study cluster together
// together but "Neymar lesionado" and "Yamal lesionado" do not.
export const DEDUP_THRESHOLD = 0.4;

function dedupBySubject(items: NewsItem[]): { kept: NewsItem[]; dropped: number } {
  const kept: NewsItem[] = [];
  let dropped = 0;
  for (const item of items) {
    const dupe = kept.find((k) => titleSimilarity(k.title, item.title) >= DEDUP_THRESHOLD);
    if (dupe) {
      dropped++;
      continue;
    }
    kept.push(item);
  }
  return { kept, dropped };
}

export async function planBatch(
  strapi: Core.Strapi,
  agents: AgentSlot[],
): Promise<BatchPlan> {
  const totalRequested = agents.reduce((s, a) => s + a.notesCount, 0);

  // Pull a wide pool of recent news (the topic is empty → no topic filter).
  // Batch mode deliberately ignores per-agent topics: it distributes whatever
  // is fresh round-robin. For beat-based coverage use per-agent schedules,
  // which DO filter by `agent.topic`.
  const pool = await getRecentNewsForTopic(strapi, "", 200);

  // Sort by recency (most recent first) so dedup keeps the freshest version
  // when multiple sources cover the same event.
  pool.sort((a, b) => {
    const ta = a.itemPublishedAt?.getTime() ?? 0;
    const tb = b.itemPublishedAt?.getTime() ?? 0;
    return tb - ta;
  });

  const { kept, dropped } = dedupBySubject(pool);
  const selected = kept.slice(0, totalRequested);

  // Initialize assignments with empty item lists.
  const assignments: BatchAssignment[] = agents.map((a) => ({
    agentDocumentId: a.documentId,
    agentName: a.name,
    items: [],
  }));

  // Round-robin distribution, respecting each agent's notesCount cap.
  let agentIdx = 0;
  for (const item of selected) {
    // Find the next agent with remaining capacity.
    let attempts = 0;
    while (
      assignments[agentIdx % assignments.length].items.length >=
      agents[agentIdx % agents.length].notesCount
    ) {
      agentIdx++;
      attempts++;
      if (attempts > agents.length) break; // safety: all full
    }
    if (attempts > agents.length) break;
    assignments[agentIdx % assignments.length].items.push(item);
    agentIdx++;
  }

  return {
    assignments,
    skippedDupes: dropped,
    poolSize: pool.length,
    requested: totalRequested,
    assigned: selected.length,
  };
}
