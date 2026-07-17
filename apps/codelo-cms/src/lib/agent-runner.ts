import type { Core } from "@strapi/strapi";
import {
  generatePost,
  generateCoverImage,
  chooseImagePrompt,
  uploadImageToStrapi,
  getOpenAIClient,
  isOpenRouterModel,
  reviewPost,
  findDuplicateSubject,
  type GeneratedPost,
} from "./openai";
import { getRecentNewsForTopic, isMundialRelevant, type NewsItem } from "./rss-fetcher";
import {
  fetchRecentFinishedMatches,
  fetchMatchDetail,
  buildMatchStatsDigest,
  isMatchStatsComplete,
} from "./match-context";
import {
  getOpenRouterImageKey,
  getOpenAIImageKey,
  getOpenAIImageModel,
  getOpenAITextKey,
  getOpenAITextModel,
} from "./openai-config";
import { getPromptSettings } from "./prompt-settings";
import { logAgentAction } from "./audit";
import { ensurePostTranslation } from "./translate-post";

type ScheduleEntry = {
  id?: number;
  days: string[];        // ["MON","TUE",...] — empty = every day
  time: string;          // "HH:MM" wall-clock in `timezone`
  timezone?: string | null; // IANA zone the time/days are authored in
  notesCount: number;
  enabled: boolean;
  lastRunAt: string | null;
};

type AgentDoc = {
  documentId: string;
  name: string;
  role: "director" | "redactor" | "image-generator" | "analyst";
  instructions: string;
  topic: string | null;
  enabled: boolean;
  schedules: ScheduleEntry[];
};

type ImageGeneratorAgentDoc = {
  documentId: string;
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
};

// Each schedule carries its own IANA zone (the wall-clock zone its time/days
// were authored in). The container TZ stays UTC; we never rely on it. This
// env only provides the fallback zone for schedules with no timezone set.
const DEFAULT_SCHEDULE_TZ = process.env.AGENT_SCHEDULE_TZ || "America/Argentina/Buenos_Aires";

const ZONED_FORMAT_OPTS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
};

// Intl.DateTimeFormat is expensive to construct; reuse one per zone.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(tz: string): Intl.DateTimeFormat {
  const key = tz || DEFAULT_SCHEDULE_TZ;
  let f = formatterCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: key, ...ZONED_FORMAT_OPTS });
    } catch {
      // Invalid IANA zone — never let a bad value break the runner.
      f = new Intl.DateTimeFormat("en-US", { timeZone: DEFAULT_SCHEDULE_TZ, ...ZONED_FORMAT_OPTS });
    }
    formatterCache.set(key, f);
  }
  return f;
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string; // "MON", "TUE", ...
};

// Wall-clock parts of an instant in `tz`, independent of process TZ.
function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = getFormatter(tz).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour,
    minute: Number(get("minute")),
    weekday: get("weekday").toUpperCase().slice(0, 3),
  };
}

function isScheduleDue(s: ScheduleEntry, now: Date): boolean {
  if (!s.enabled || !s.time) return false;

  const tz = s.timezone || DEFAULT_SCHEDULE_TZ;
  const [h, m] = s.time.split(":").map(Number);
  const nowZ = zonedParts(now, tz);
  if (nowZ.hour !== h || nowZ.minute !== m) return false;

  // Skip if already ran in this exact minute (compared in the same zone)
  if (s.lastRunAt) {
    const last = zonedParts(new Date(s.lastRunAt), tz);
    if (
      last.year === nowZ.year &&
      last.month === nowZ.month &&
      last.day === nowZ.day &&
      last.hour === h &&
      last.minute === m
    ) {
      return false;
    }
  }

  const days = s.days ?? [];
  if (days.length === 0) return true; // every day
  return days.includes(nowZ.weekday);
}

export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return `${base || "post"}-${Date.now().toString(36)}`;
}

async function findActiveImageGenerator(strapi: Core.Strapi): Promise<ImageGeneratorAgentDoc | null> {
  const results = await strapi.documents("api::agent.agent").findMany({
    filters: { role: "image-generator", enabled: true },
  });
  return (results[0] as unknown as ImageGeneratorAgentDoc) ?? null;
}

async function findActiveDirector(strapi: Core.Strapi): Promise<AgentDoc | null> {
  const directors = await strapi.documents("api::agent.agent").findMany({
    filters: { role: "director", enabled: true },
  });
  return (directors[0] as unknown as AgentDoc) ?? null;
}

export async function runRedactor(
  strapi: Core.Strapi,
  agent: AgentDoc,
  notesCount = 1,
  assignedItems?: NewsItem[],
): Promise<void> {
  const client = getOpenAIClient(getOpenAITextKey());
  const model = await getOpenAITextModel(strapi);
  const director = await findActiveDirector(strapi);
  const promptSettings = await getPromptSettings(strapi);

  // Two modes:
  //  - "assigned" mode (assignedItems provided): each iteration covers ONE
  //    specific pre-assigned news item. Used by run-batch for deterministic
  //    distribution that prevents two redactors from picking the same subject.
  //  - "free" mode (no assignedItems): legacy behavior — fetch a pool of news
  //    and let the LLM pick what to write about (with dedup hints).
  const isAssignedMode = assignedItems !== undefined && assignedItems.length > 0;

  // Pool used only in free mode.
  const rawNews = !isAssignedMode && agent.topic
    ? await getRecentNewsForTopic(strapi, agent.topic, 50)
    : [];
  const mundialNews = rawNews.filter(isMundialRelevant);
  const recentNews = isAssignedMode
    ? assignedItems!
    : mundialNews.length > 0
      ? mundialNews.slice(0, 10)
      : rawNews.slice(0, 10);

  const hasContext = recentNews.length > 0;
  const usedFallback = mundialNews.length === 0 && rawNews.length > 0;
  if (usedFallback) {
    strapi.log.warn(
      `[agent-runner] Redactor "${agent.name}": no Mundial-relevant news found in last 24h; ` +
        `falling back to generic football news (${rawNews.length} items).`,
    );
  }

  const sharedNewsContextBlock = !isAssignedMode && hasContext
    ? [
        "\nVerified news context (last 24h) — base your article EXCLUSIVELY on these facts:",
        ...recentNews.map(
          (n, i) =>
            `[${i + 1}] ${n.source} | ${n.title}\n${(n.summary ?? "").slice(0, 300)}`,
        ),
      ].join("\n")
    : "";

  const contentTypeGuidance = hasContext
    ? [
        "\n## STRICT FACTUAL RULES",
        "- Write a news/recap article based ONLY on the verified context above.",
        `- NEVER invent ${promptSettings.fabricationProneFacts}.`,
        "- Every specific fact you mention must appear in the context above.",
        "- If uncertain about a fact, omit it or write 'según fuentes' without fabricating details.",
        "",
        "## TITLE RULES (CRITICAL — most hallucinations come from bad titles)",
        "- The title MUST describe ONE single concrete fact that appears in ONE single source above.",
        "- NEVER combine two unrelated facts into one title (e.g. if source A says 'X is sad' and source B says 'Y is injured', DO NOT write 'X and Y are injured').",
        "- The title MUST NOT contradict the body of the article. If the body says 'X wants to play', the title cannot say 'X will not play'.",
        "- The title MUST NOT contradict the source. If the source headline says 'X is excited about the World Cup', the title cannot imply X is out.",
        "- Prefer factual, neutral titles over sensationalist clickbait.",
        "- If the title mentions a player, the named action (injury, transfer, statement) must be literally about THAT player in the source.",
        "",
        "## SELF-CHECK before returning",
        "Before returning your JSON, mentally verify:",
        "  1. Does my title say something that ANY source explicitly says? Yes/no.",
        "  2. If I removed the body, would the title alone be defensible from the sources? Yes/no.",
        "  3. Does my title contradict anything in my own body? Yes/no.",
        "If any answer is wrong, rewrite the title to a safer, more literal version.",
      ].join("\n")
    : [
        "\n## STRICT RULES — no verified news available",
        `- NO news context is available. Do NOT invent ${promptSettings.fabricationProneFacts}, nor any current events.`,
        "- Write ONLY: historical analysis, previews, profiles, or opinion pieces.",
        "- Make clear in the article that it is analysis/preview, not breaking news.",
        "- Never claim an event happened or a result occurred if you have no verified source.",
        `- TITLE: must be ${promptSettings.analysisModeFraming}`,
      ].join("\n");

  const buildSystemPrompt = (newsBlock: string): string =>
    [
      `You are a journalist writing in ${promptSettings.writingLanguage} for ${promptSettings.domainDescription}.`,
      "Voice & tone:",
      agent.instructions,
      agent.topic ? `\nTopic to cover:\n${agent.topic}` : "",
      director?.instructions
        ? `\nGlobal editorial guidelines from the director:\n${director.instructions}`
        : "",
      newsBlock,
      contentTypeGuidance,
      `\n${promptSettings.bodyStructureGuide}`,
      `\nReturn STRICT JSON: { "title": string, "excerpt": string (1-2 sentences), "content": string (rich GitHub-Flavored Markdown, ~600 words) }`,
    ]
      .filter(Boolean)
      .join("\n");

  const dedupWindow = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  async function fetchRecentTitles(): Promise<string[]> {
    const [drafts, published] = await Promise.all([
      strapi.documents("api::post.post").findMany({
        status: "draft",
        fields: ["title", "documentId"],
        filters: { createdAt: { $gte: dedupWindow.toISOString() } },
        limit: 100,
      }),
      strapi.documents("api::post.post").findMany({
        status: "published",
        fields: ["title", "documentId"],
        filters: { createdAt: { $gte: dedupWindow.toISOString() } },
        limit: 100,
      }),
    ]) as unknown as [
      Array<{ title: string; documentId: string }>,
      Array<{ title: string; documentId: string }>,
    ];

    const titlesByDoc = new Map<string, string>();
    for (const d of [...published, ...drafts]) {
      if (d.title && !titlesByDoc.has(d.documentId)) {
        titlesByDoc.set(d.documentId, d.title);
      }
    }
    return Array.from(titlesByDoc.values());
  }

  const iterations = isAssignedMode ? assignedItems!.length : notesCount;

  for (let i = 0; i < iterations; i++) {
    const today = new Date().toISOString().slice(0, 10);
    const assignedItem = isAssignedMode ? assignedItems![i] : null;

    const newsBlock = assignedItem
      ? [
          "\n## ASSIGNED NEWS ITEM — write your article SPECIFICALLY about this and nothing else",
          `[1] ${assignedItem.source} | ${assignedItem.title}`,
          assignedItem.summary ? `${assignedItem.summary.slice(0, 600)}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : sharedNewsContextBlock;

    const systemPrompt = buildSystemPrompt(newsBlock);

    // Recent post titles (published + drafts, last 7 days) — used both as a soft
    // LLM hint (non-assigned mode) and as a HARD gate below, in every mode.
    // Re-fetched per iteration so posts created earlier in this run also count.
    const recentTitles = await fetchRecentTitles();

    let dedupBlock = "";
    if (!isAssignedMode && recentTitles.length > 0) {
      dedupBlock = [
        "\n## ALREADY-COVERED SUBJECTS — DO NOT REPEAT",
        "These titles already exist as drafts. Write about a DIFFERENT subject from the news context above (a different player, team, event, or angle).",
        "If the same person/event is the only candidate, find a DIFFERENT angle (a different fact, a different framing) — never duplicate the same headline subject.",
        ...recentTitles.map((t) => `  - "${t}"`),
      ].join("\n");
    }

    const lang = promptSettings.writingLanguage;
    const userPrompt = assignedItem
      ? `Write a news article in ${lang} for today (${today}) based EXCLUSIVELY on the assigned news item above. Return only the JSON.`
      : hasContext
        ? `Write a news article in ${lang} based on the verified context above (${today}).${dedupBlock}\nReturn only the JSON.`
        : `Write an analysis or preview article in ${lang} for today (${today}). No invented facts.${dedupBlock}\nReturn only the JSON.`;
    const generated = await generatePost(client, model, systemPrompt, userPrompt);

    // HARD dedup gate: the LLM hint is advisory and absent in assigned/batch mode,
    // so a reworded headline of the same event still slips through. A semantic
    // check (vs lexical similarity) catches "same event, different title" without
    // flagging preview-vs-result or two teams' separate squad lists.
    const duplicateOf = await findDuplicateSubject(client, model, generated.title, recentTitles);
    if (duplicateOf) {
      strapi.log.warn(
        `[agent] "${agent.name}": skipped duplicate post "${generated.title}" ` +
          `(too similar to existing "${duplicateOf}")`,
      );
      continue;
    }

    const createdDraft = (await strapi.documents("api::post.post").create({
      data: {
        title: generated.title,
        slug: makeSlug(generated.title),
        excerpt: generated.excerpt,
        content: generated.content,
        authorName: agent.name,
        generatedByAgent: agent.documentId,
      },
      status: "draft",
    })) as unknown as { documentId: string; title: string };

    strapi.log.info(
      `[agent-runner] Redactor "${agent.name}" created draft (${i + 1}/${notesCount}): ${generated.title}`,
    );

    await logAgentAction(strapi, {
      agentRole: "redactor",
      action: "draft_created",
      agentName: agent.name,
      agentDocumentId: agent.documentId,
      postDocumentId: createdDraft.documentId,
      postTitle: createdDraft.title,
      summary: `Redactor "${agent.name}" creó draft: "${createdDraft.title}"`,
      metadata: {
        iteration: i + 1,
        of: iterations,
        mode: isAssignedMode ? "assigned" : "free",
        topic: agent.topic ?? null,
      },
    });
  }
}

// "Capa 2" of the AdSense remediation: ORIGINAL, data-driven match analyses
// written ONLY from the site's own stats (xG, player ratings, formations).
// Mirrors runRedactor's client/model/draft/audit plumbing, but its source
// material is the match-stats digest fetched over HTTP from the web app's
// internal API — NOT RSS news. Creates DRAFTS only; never publishes, never
// translates (Spanish only for now).
export async function runAnalyst(
  strapi: Core.Strapi,
  agent: AgentDoc,
  notesCount = 1,
  // Accepted for dispatch-signature parity with runRedactor; the analyst
  // discovers its own matches and ignores any pre-assigned news items.
  _assignedItems?: NewsItem[],
): Promise<void> {
  const textKey = getOpenAITextKey();
  const client = getOpenAIClient(textKey);
  const model = await getOpenAITextModel(strapi);
  const director = await findActiveDirector(strapi);
  const promptSettings = await getPromptSettings(strapi);

  // Cover-image pipeline (same as the Director): the analyst auto-publishes, so
  // it generates a cover before publishing. A missing OpenRouter key is handled
  // per-post (cover_failed) rather than aborting the run.
  const imageKey = getOpenAIImageKey();
  const imageModel = await getOpenAIImageModel(strapi);
  let openrouterKey: string | undefined;
  if (isOpenRouterModel(imageModel)) {
    try {
      openrouterKey = getOpenRouterImageKey();
    } catch {
      // Missing OPENROUTER_API_KEY surfaces as a per-post cover_failed below.
    }
  }
  const imgAgent = await findActiveImageGenerator(strapi);

  // Source material: recently-finished matches. A misconfig (missing env) throws
  // inside the fetch helper — catch + skip so the cron tick no-ops instead of
  // crashing the whole runner.
  let candidates: Awaited<ReturnType<typeof fetchRecentFinishedMatches>>;
  try {
    candidates = await fetchRecentFinishedMatches();
  } catch (err) {
    strapi.log.warn(
      `[agent-runner] Analyst "${agent.name}" could not fetch recent matches (skipping): ${(err as Error).message}`,
    );
    return;
  }

  // Dedupe: never analyze the same match twice. Check BOTH draft and published
  // posts so a regeneration can't slip through after the director publishes.
  async function alreadyAnalyzed(matchId: string): Promise<boolean> {
    const [drafts, published] = await Promise.all([
      strapi.documents("api::post.post").findMany({
        filters: { sourceMatchId: matchId },
        status: "draft",
        fields: ["documentId"],
        limit: 1,
      }) as never,
      strapi.documents("api::post.post").findMany({
        filters: { sourceMatchId: matchId },
        status: "published",
        fields: ["documentId"],
        limit: 1,
      }) as never,
    ]) as unknown as [Array<{ documentId: string }>, Array<{ documentId: string }>];
    return drafts.length > 0 || published.length > 0;
  }

  // Take the first `notesCount` un-analyzed matches.
  const chosen: typeof candidates = [];
  for (const m of candidates) {
    if (chosen.length >= notesCount) break;
    if (await alreadyAnalyzed(m.matchId)) continue;
    chosen.push(m);
  }

  if (chosen.length === 0) {
    strapi.log.info(
      `[agent-runner] Analyst "${agent.name}" found no new finished matches to analyze.`,
    );
    return;
  }

  const lang = promptSettings.writingLanguage;
  let produced = 0;

  for (const candidate of chosen) {
    // One failure must not abort the rest.
    try {
      const detail = await fetchMatchDetail(candidate.matchId);
      if (!detail) {
        strapi.log.warn(
          `[agent-runner] Analyst "${agent.name}": match ${candidate.matchId} returned no detail; skipping.`,
        );
        continue;
      }

      // Auto-publish gate. The analyst's value is xG + ratings, which data
      // providers fill a few hours AFTER full time. If they're not in yet and
      // the match finished recently, skip WITHOUT creating anything so a later
      // run retries and auto-publishes once the stats land (zero manual work).
      // Only for a match whose stats never arrived (finished long ago) do we
      // fall back to leaving a draft, so nothing is silently lost.
      const statsComplete = isMatchStatsComplete(detail);
      const kickoffMs = candidate.kickoffAt ? Date.parse(candidate.kickoffAt) : NaN;
      const hoursSinceKickoff = Number.isFinite(kickoffMs)
        ? (Date.now() - kickoffMs) / 3_600_000
        : Infinity;
      const STALE_HOURS = 12;
      if (!statsComplete && hoursSinceKickoff < STALE_HOURS) {
        strapi.log.info(
          `[agent-runner] Analyst "${agent.name}": stats not ready for ${candidate.matchId}; will retry on a later run.`,
        );
        continue; // no post created → dedupe won't block the retry
      }

      const digest = buildMatchStatsDigest(detail);

      const systemPrompt = [
        promptSettings.analystSystemInstructions,
        "\nVoz y tono adicionales del agente:",
        agent.instructions,
        director?.instructions
          ? `\nLineamientos editoriales del director:\n${director.instructions}`
          : "",
        `\n${promptSettings.analystBodyStructure}`,
        "\n## REGLA DURA",
        "Escribí SOLO con los hechos del bloque de datos de abajo; NO inventes nada que no esté ahí; tono rioplatense, análisis, markdown.",
        `\nDevolvé STRICT JSON: { "title": string, "excerpt": string (1-2 oraciones), "content": string (Markdown rico, ~450-650 palabras) }`,
      ]
        .filter(Boolean)
        .join("\n");

      const userPrompt = [
        `Escribí un análisis del partido en ${lang}, usando EXCLUSIVAMENTE el siguiente bloque de datos. No agregues ningún dato que no esté acá.`,
        "",
        "## BLOQUE DE DATOS DEL PARTIDO (verdad absoluta)",
        digest,
        "",
        "Devolvé solo el JSON.",
      ].join("\n");

      const generated = await generatePost(client, model, systemPrompt, userPrompt);

      const createdDraft = (await strapi.documents("api::post.post").create({
        data: {
          title: generated.title,
          slug: makeSlug(generated.title),
          excerpt: generated.excerpt,
          content: generated.content,
          authorName: agent.name,
          generatedByAgent: agent.documentId,
          sourceMatchId: candidate.matchId,
        },
        status: "draft",
      })) as unknown as { documentId: string; title: string };
      produced++;

      // Stale match whose stats never arrived: keep it as a draft for human
      // review instead of auto-publishing an analysis full of "s/d".
      if (!statsComplete) {
        strapi.log.info(
          `[agent-runner] Analyst "${agent.name}" left draft (stats never arrived) for ${candidate.matchId}: ${generated.title}`,
        );
        await logAgentAction(strapi, {
          agentRole: "analyst",
          action: "draft_created",
          agentName: agent.name,
          agentDocumentId: agent.documentId,
          postDocumentId: createdDraft.documentId,
          postTitle: createdDraft.title,
          summary: `Analyst "${agent.name}" dejó draft (stats incompletas): "${createdDraft.title}"`,
          metadata: {
            iteration: produced,
            of: chosen.length,
            sourceMatchId: candidate.matchId,
            league: candidate.leagueName,
            reason: "incomplete_stats",
          },
        });
        continue;
      }

      // Stats complete → generate a cover (same pipeline as the Director) and
      // publish automatically. A cover failure is non-fatal: publish anyway.
      let coverImageId: number | null = null;
      let chosenPrompt: string | null = null;
      if (imgAgent) {
        try {
          const recent = (await strapi.documents("api::post.post").findMany({
            filters: { coverPrompt: { $notNull: true } },
            sort: { createdAt: "desc" },
            fields: ["coverPrompt"],
            limit: 10,
          } as never)) as unknown as Array<{ coverPrompt: string | null }>;
          const recentDescriptions = recent.map((r) => r.coverPrompt!).filter(Boolean);
          chosenPrompt = await chooseImagePrompt(client, model, {
            title: generated.title,
            excerpt: generated.excerpt,
            seedKey: `${createdDraft.documentId}|${generated.title}`,
            recentDescriptions,
            systemInstructions:
              imgAgent.imagePromptTemplate?.trim() || promptSettings.imageSystemInstructions,
            themeGuide: promptSettings.imageThemeGuide,
            anchorTaxonomy: promptSettings.imageAnchorTaxonomy,
          });
          const imageBuffer = await generateCoverImage(
            { openaiImageKey: imageKey, openrouterKey },
            imageModel,
            chosenPrompt,
            { size: imgAgent.imageSize ?? undefined, quality: imgAgent.imageQuality ?? undefined },
          );
          const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
          const filename = `cover-${createdDraft.documentId}-${Date.now()}.${ext}`;
          coverImageId = await uploadImageToStrapi(
            strapi as Parameters<typeof uploadImageToStrapi>[0],
            imageBuffer,
            filename,
            generated.title,
          );
          await logAgentAction(strapi, {
            agentRole: "image-generator",
            action: "cover_generated",
            agentName: "Image Generator",
            agentDocumentId: imgAgent.documentId ?? null,
            postDocumentId: createdDraft.documentId,
            postTitle: generated.title,
            summary: `Generador de Imágenes generó cover para: "${generated.title}"`,
            metadata: { model: imageModel, triggeredBy: agent.name, trigger: "analyst" },
          });
        } catch (imgErr) {
          strapi.log.warn(
            `[agent-runner] Analyst cover generation failed (publishing without image):`,
            imgErr,
          );
          await logAgentAction(strapi, {
            agentRole: "image-generator",
            action: "cover_failed",
            agentName: "Image Generator",
            agentDocumentId: imgAgent.documentId ?? null,
            postDocumentId: createdDraft.documentId,
            postTitle: generated.title,
            summary: `Generador de Imágenes falló cover para: "${generated.title}"`,
            metadata: { error: (imgErr as Error).message, triggeredBy: agent.name },
          });
        }
      }

      if (coverImageId || chosenPrompt) {
        await strapi.documents("api::post.post").update({
          documentId: createdDraft.documentId,
          data: {
            ...(coverImageId ? { coverImage: coverImageId } : {}),
            ...(chosenPrompt ? { coverPrompt: chosenPrompt } : {}),
          } as never,
        });
      }

      await strapi.documents("api::post.post").publish({ documentId: createdDraft.documentId });

      strapi.log.info(
        `[agent-runner] Analyst "${agent.name}" PUBLISHED (${produced}/${chosen.length}) for match ${candidate.matchId}: ${generated.title}`,
      );
      await logAgentAction(strapi, {
        agentRole: "analyst",
        action: "draft_published",
        agentName: agent.name,
        agentDocumentId: agent.documentId,
        postDocumentId: createdDraft.documentId,
        postTitle: createdDraft.title,
        summary: `Analyst "${agent.name}" publicó: "${createdDraft.title}"`,
        metadata: {
          iteration: produced,
          of: chosen.length,
          sourceMatchId: candidate.matchId,
          league: candidate.leagueName,
        },
      });
    } catch (err) {
      strapi.log.error(
        `[agent-runner] Analyst "${agent.name}" failed on match ${candidate.matchId}:`,
        err,
      );
      await logAgentAction(strapi, {
        agentRole: "analyst",
        action: "agent_failed",
        agentName: agent.name,
        agentDocumentId: agent.documentId,
        summary: `Analyst "${agent.name}" falló analizando match ${candidate.matchId}`,
        metadata: { sourceMatchId: candidate.matchId, error: (err as Error).message },
      });
    }
  }
}

async function runDirector(
  strapi: Core.Strapi,
  agent: AgentDoc,
  notesCount = 1,
): Promise<void> {
  const textKey = getOpenAITextKey();
  const imageKey = getOpenAIImageKey();
  const textModel = await getOpenAITextModel(strapi);
  const imageModel = await getOpenAIImageModel(strapi);
  const promptSettings = await getPromptSettings(strapi);
  const client = getOpenAIClient(textKey);
  // Resolve the OpenRouter key up front, but a missing key must not abort the whole
  // director run — generateCoverImage surfaces it as a per-draft cover_failed.
  let openrouterKey: string | undefined;
  if (isOpenRouterModel(imageModel)) {
    try {
      openrouterKey = getOpenRouterImageKey();
    } catch {
      // Missing OPENROUTER_API_KEY is handled per-draft below, not fatal here.
    }
  }
  const imgAgent = await findActiveImageGenerator(strapi);

  const draftPool = (await strapi.documents("api::post.post").findMany({
    // Redactor drafts only. Analyst drafts (identified by a non-null
    // sourceMatchId) are grounded in match STATS, not RSS news — the Director's
    // news-fabrication check can't verify xG/ratings against the feed and would
    // wrongly reject (and DELETE) them. They are meant for human review, so the
    // Director leaves them untouched as drafts.
    filters: {
      generatedByAgent: { documentId: { $notNull: true } },
      sourceMatchId: { $null: true },
      // Skip drafts the Director already rejected (archived, not deleted) so it
      // doesn't re-review and re-reject them on every run.
      directorRejectionReason: { $null: true },
    },
    status: "draft",
    populate: ["generatedByAgent"],
    sort: { createdAt: "desc" },
    limit: Math.max(notesCount * 3, 30),
  })) as unknown as Array<{
    documentId: string;
    title: string;
    excerpt: string | null;
    content: string | null;
  }>;

  const publishedIds = new Set(
    (
      (await strapi.documents("api::post.post").findMany({
        filters: { generatedByAgent: { documentId: { $notNull: true } } },
        status: "published",
        fields: ["documentId"],
        limit: 500,
      })) as unknown as Array<{ documentId: string }>
    ).map((p) => p.documentId),
  );

  // Candidate pool = ALL recent unpublished drafts (NOT sliced to notesCount).
  // The loop below publishes until it reaches notesCount, so a rejected draft is
  // replaced by the next candidate instead of shrinking the published total.
  const candidates = draftPool.filter((d) => !publishedIds.has(d.documentId));

  if (candidates.length === 0) {
    strapi.log.info(`[agent-runner] Director "${agent.name}" had no drafts to publish.`);
    await logAgentAction(strapi, {
      agentRole: "director",
      action: "director_idle",
      agentName: agent.name,
      agentDocumentId: agent.documentId,
      summary: `Director "${agent.name}" no encontró drafts para revisar`,
      metadata: { poolSize: draftPool.length, filteredOut: draftPool.length },
    });
    return;
  }

  strapi.log.info(
    `[agent-runner] Director targeting ${notesCount} publication(s) from a pool of ` +
      `${candidates.length} unpublished draft(s).`,
  );

  const STAGGER_MINUTES = 35;
  let publishedCount = 0;

  for (const draft of candidates) {
    if (publishedCount >= notesCount) break; // reached the publication target
    try {
      const draftQuery = `${draft.title ?? ""} ${draft.excerpt ?? ""}`;
      const [keywordNews, broadNews] = await Promise.all([
        getRecentNewsForTopic(strapi, draftQuery, 25),
        getRecentNewsForTopic(strapi, "", 40),
      ]);
      const byUrl = new Map<string, (typeof keywordNews)[number]>();
      for (const n of [...keywordNews, ...broadNews]) {
        if (!byUrl.has(n.url)) byUrl.set(n.url, n);
      }
      const finalNews = Array.from(byUrl.values()).slice(0, 50);
      const newsContextForReview = finalNews
        .map((n, i) => `[${i + 1}] ${n.source} | ${n.title}\n${(n.summary ?? "").slice(0, 300)}`)
        .join("\n");

      const result = await reviewPost(client, textModel, agent.instructions, {
        title: draft.title,
        excerpt: draft.excerpt ?? "",
        content: draft.content ?? "",
      }, newsContextForReview, promptSettings.fabricationProneFacts);

      if (result.rejected) {
        strapi.log.warn(
          `[agent-runner] Director REJECTED draft "${draft.title}": ${result.reason}`,
        );
        await logAgentAction(strapi, {
          agentRole: "director",
          action: "draft_rejected",
          agentName: agent.name,
          agentDocumentId: agent.documentId,
          postDocumentId: draft.documentId,
          postTitle: draft.title,
          summary: `Director "${agent.name}" rechazó: "${draft.title}"`,
          metadata: { reason: result.reason },
        });
        // Archive instead of delete: the Director's news-fabrication check has
        // false positives (a TRUE result simply absent from the RSS feed reads
        // as "fabricated"), and deleting destroys recoverable work. We stamp the
        // reason and keep the draft, then exclude it from future Director pools
        // (see the draftPool filter) so it isn't re-reviewed in a loop. A human
        // can rescue real ones from Content Manager or discard the rest.
        await strapi.documents("api::post.post").update({
          documentId: draft.documentId,
          data: { directorRejectionReason: result.reason },
          status: "draft",
        });
        continue;
      }

      const refined = result as GeneratedPost;

      let coverImageId: number | null = null;
      let chosenPrompt: string | null = null;
      if (imgAgent) {
        try {
          // Fetch the last 10 cover prompts so the new one is forced to differ.
          const recent = (await strapi.documents("api::post.post").findMany({
            filters: { coverPrompt: { $notNull: true } },
            sort: { createdAt: "desc" },
            fields: ["coverPrompt"],
            limit: 10,
          } as never)) as unknown as Array<{ coverPrompt: string | null }>;
          const recentDescriptions = recent.map((r) => r.coverPrompt!).filter(Boolean);

          chosenPrompt = await chooseImagePrompt(getOpenAIClient(textKey), textModel, {
            title: refined.title,
            excerpt: refined.excerpt,
            seedKey: `${draft.documentId}|${refined.title}`,
            recentDescriptions,
            systemInstructions: imgAgent.imagePromptTemplate?.trim() || promptSettings.imageSystemInstructions,
            themeGuide: promptSettings.imageThemeGuide,
            anchorTaxonomy: promptSettings.imageAnchorTaxonomy,
          });
          const imageBuffer = await generateCoverImage(
            { openaiImageKey: imageKey, openrouterKey },
            imageModel,
            chosenPrompt,
            {
              size: imgAgent.imageSize ?? undefined,
              quality: imgAgent.imageQuality ?? undefined,
            },
          );
          const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
          const filename = `cover-${draft.documentId}-${Date.now()}.${ext}`;
          coverImageId = await uploadImageToStrapi(
            strapi as Parameters<typeof uploadImageToStrapi>[0],
            imageBuffer,
            filename,
            refined.title,
          );
          strapi.log.info(`[agent-runner] Cover image generated for: ${refined.title}`);
          await logAgentAction(strapi, {
            agentRole: "image-generator",
            action: "cover_generated",
            agentName: imgAgent.documentId ? `Image Generator` : "Image Generator",
            agentDocumentId: imgAgent.documentId ?? null,
            postDocumentId: draft.documentId,
            postTitle: refined.title,
            summary: `Generador de Imágenes generó cover para: "${refined.title}"`,
            metadata: { model: imageModel, triggeredBy: agent.name, trigger: "director" },
          });
        } catch (imgErr) {
          strapi.log.warn(`[agent-runner] Image generation failed (publishing without image):`, imgErr);
          await logAgentAction(strapi, {
            agentRole: "image-generator",
            action: "cover_failed",
            agentName: "Image Generator",
            agentDocumentId: imgAgent.documentId ?? null,
            postDocumentId: draft.documentId,
            postTitle: refined.title,
            summary: `Generador de Imágenes falló cover para: "${refined.title}"`,
            metadata: { error: (imgErr as Error).message, triggeredBy: agent.name },
          });
        }
      } else {
        strapi.log.info(`[agent-runner] No image-generator agent configured; skipping cover image.`);
      }

      await strapi.documents("api::post.post").update({
        documentId: draft.documentId,
        data: {
          title: refined.title,
          excerpt: refined.excerpt,
          content: refined.content,
          ...(coverImageId ? { coverImage: coverImageId } : {}),
          ...(chosenPrompt ? { coverPrompt: chosenPrompt } : {}),
        } as never,
      });

      await strapi.documents("api::post.post").publish({
        documentId: draft.documentId,
      });

      if (publishedCount > 0) {
        const staggered = new Date(Date.now() - publishedCount * STAGGER_MINUTES * 60 * 1000);
        try {
          await strapi.db
            .connection("posts")
            .where({ document_id: draft.documentId, locale: "es" })
            .whereNotNull("published_at")
            .update({ published_at: staggered });
        } catch (staggerErr) {
          strapi.log.debug(`[agent-runner] stagger publishedAt failed (non-fatal):`, staggerErr);
        }
      }
      publishedCount++;

      // Translate to English as part of the Director's job. A translation
      // failure must never block or unpublish the Spanish note — the publish
      // middleware acts as a retry on the next publish, and the admin
      // translate endpoints can backfill manually.
      try {
        await ensurePostTranslation(strapi, draft.documentId, { trigger: "director" });
      } catch (trErr) {
        strapi.log.warn(
          `[agent-runner] translation failed for ${draft.documentId} (non-fatal):`,
          trErr,
        );
      }

      strapi.log.info(`[agent-runner] Director "${agent.name}" published: ${refined.title}`);
      await logAgentAction(strapi, {
        agentRole: "director",
        action: "draft_published",
        agentName: agent.name,
        agentDocumentId: agent.documentId,
        postDocumentId: draft.documentId,
        postTitle: refined.title,
        summary: `Director "${agent.name}" publicó: "${refined.title}"`,
        metadata: {
          hasCover: Boolean(coverImageId),
          staggered: publishedCount > 1,
          position: publishedCount,
        },
      });
    } catch (err) {
      strapi.log.error(
        `[agent-runner] Director "${agent.name}" failed on draft ${draft.documentId}:`,
        err,
      );
      await logAgentAction(strapi, {
        agentRole: "director",
        action: "agent_failed",
        agentName: agent.name,
        agentDocumentId: agent.documentId,
        postDocumentId: draft.documentId,
        postTitle: draft.title,
        summary: `Director "${agent.name}" falló procesando: "${draft.title}"`,
        metadata: { error: (err as Error).message },
      });
    }
  }

  if (publishedCount < notesCount) {
    strapi.log.warn(
      `[agent-runner] Director "${agent.name}" published ${publishedCount}/${notesCount} — ` +
        `ran out of acceptable drafts in the pool (rejected or none left to try).`,
    );
  }
}

export async function runDueAgents(strapi: Core.Strapi): Promise<void> {
  const now = new Date();

  try {
    getOpenAITextKey();
  } catch {
    strapi.log.debug("[agent-runner] OPENAI_API_KEY missing; skipping tick.");
    return;
  }

  const agents = (await strapi.documents("api::agent.agent").findMany({
    filters: { enabled: true },
    populate: ["schedules"],
  })) as unknown as AgentDoc[];

  for (const agent of agents) {
    const schedules = agent.schedules ?? [];
    const dueSchedules = schedules.filter((s) => isScheduleDue(s, now));

    if (dueSchedules.length === 0) continue;

    for (const schedule of dueSchedules) {
      try {
        const notesCount = schedule.notesCount ?? 1;
        if (agent.role === "redactor") {
          await runRedactor(strapi, agent, notesCount);
        } else if (agent.role === "analyst") {
          await runAnalyst(strapi, agent, notesCount);
        } else if (agent.role === "director") {
          await runDirector(strapi, agent, notesCount);
        }
        // "image-generator" has no autonomous execution — it only provides config
        schedule.lastRunAt = now.toISOString();
      } catch (err) {
        strapi.log.error(`[agent-runner] Agent "${agent.name}" schedule failed:`, err);
      }
    }

    await strapi.documents("api::agent.agent").update({
      documentId: agent.documentId,
      data: {
        schedules: schedules.map((s) => ({
          id: s.id,
          days: s.days,
          time: s.time,
          notesCount: s.notesCount,
          enabled: s.enabled,
          lastRunAt: s.lastRunAt,
        })),
        lastRunAt: now.toISOString(),
      },
    });
  }
}

export async function runAgentNow(
  strapi: Core.Strapi,
  documentId: string,
  notesCount: number,
): Promise<void> {
  try {
    getOpenAITextKey();
  } catch {
    throw new Error("OpenAI API key not configured (set OPENAI_API_KEY env var).");
  }

  const agent = (await strapi.documents("api::agent.agent").findOne({
    documentId,
    populate: ["schedules"],
  })) as unknown as AgentDoc | null;

  if (!agent) throw new Error(`Agent ${documentId} not found.`);

  if (agent.role === "redactor") {
    await runRedactor(strapi, agent, notesCount);
  } else if (agent.role === "analyst") {
    await runAnalyst(strapi, agent, notesCount);
  } else if (agent.role === "director") {
    await runDirector(strapi, agent, notesCount);
  } else {
    throw new Error(`Agent role "${agent.role}" cannot be run directly.`);
  }

  await strapi.documents("api::agent.agent").update({
    documentId,
    data: { lastRunAt: new Date().toISOString() },
  });
}
