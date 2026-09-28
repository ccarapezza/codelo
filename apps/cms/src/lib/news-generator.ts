// Manual news generator — the backend behind the admin "Generador de notas"
// screen. It is the human-driven alternative to the redactor agents: an admin
// types a prompt, the model (optionally) searches the web for current context,
// and we generate / refine a branded article. All the strict-JSON article
// generation reuses `generatePost`/`stripInlineMarkdown` from ./openai; this
// module only adds the web-search research step and the refine helper, plus the
// shared prompt construction (which reuses the brand guardrails in PromptSettings).
import type OpenAI from "openai";
import { stripInlineMarkdown, type GeneratedPost } from "./openai";
import type { PromptSettings } from "./prompt-defaults";
import { TITLE_ORIGINALITY_RULES } from "./headline-similarity";

export interface ResearchResult {
  /** Plain-text briefing of current facts, fed into the article generation. */
  context: string;
  /** De-duplicated web sources the model cited. */
  sources: Array<{ title: string; url: string }>;
}

/**
 * Step (a): hosted web search via the OpenAI Responses API `web_search_preview`
 * tool. Returns a plain-text facts briefing + cited sources. Fails SOFT: any
 * error (model doesn't support the tool, network, etc.) returns empty research
 * so article generation can still proceed without fresh facts.
 */
export async function researchWithWebSearch(
  client: OpenAI,
  model: string,
  prompt: string,
): Promise<ResearchResult> {
  try {
    const response = await client.responses.create({
      model,
      tools: [{ type: "web_search_preview" }],
      input: [
        {
          role: "system",
          content:
            "You are a news researcher. Search the web for the most recent and " +
            "verifiable facts about the user's request. Reply ONLY with a short " +
            "plain-text briefing of the concrete facts (what happened, who, when, " +
            "outcome, verbatim quotes if any), with their context. Do NOT write an " +
            "article: only the facts. Do not name or credit any media outlet; report " +
            "the underlying fact.",
        },
        { role: "user", content: prompt },
      ],
    });

    let context = (response.output_text ?? "").trim();

    const sources: Array<{ title: string; url: string }> = [];
    const seen = new Set<string>();
    for (const item of response.output ?? []) {
      if (item.type !== "message") continue;
      for (const part of item.content ?? []) {
        if (part.type !== "output_text") continue;
        if (!context) context = String(part.text ?? "").trim();
        for (const ann of part.annotations ?? []) {
          if (ann.type === "url_citation" && ann.url && !seen.has(ann.url)) {
            seen.add(ann.url);
            sources.push({ title: ann.title || ann.url, url: ann.url });
          }
        }
      }
    }
    return { context, sources };
  } catch (err) {
    // web_search_preview unsupported / tool error / network → degrade gracefully.
    return { context: "", sources: [] };
  }
}

/**
 * System prompt shared by generate & refine. Reuses the resolved PromptSettings
 * exactly like the redactor — most importantly `bodyStructureGuide`, which holds
 * the no-rival-media brand guardrail (never name another outlet as the subject
 * or authority; official sources are exempt) plus the Markdown structure rules.
 */
export function buildNewsSystemPrompt(s: PromptSettings): string {
  return [
    `You are a journalist writing in ${s.writingLanguage} for ${s.domainDescription}.`,
    "The article is generated from an editor's manual prompt (and optionally from web research).",
    `Voice: ${s.brandName}'s own editorial voice — independent and considered, without grandiloquence.`,
    "",
    "## STRICT FACTUAL RULES",
    `- NEVER invent ${s.fabricationProneFacts}. If a fact is not in the research block or in the editor's request, do not state it as fact.`,
    "- With no research block, write as analysis/preview; do not state recent events as fact.",
    "",
    "## TITLE RULES",
    "- One single concrete, literal fact. No clickbait. It must not contradict the body.",
    ...TITLE_ORIGINALITY_RULES,
    "",
    s.bodyStructureGuide,
    "",
    `Write the article in ${s.writingLanguage}.`,
    `Return STRICT JSON: { "title": string, "excerpt": string (1-2 sentences), "content": string (GitHub-Flavored Markdown, ~500-650 words) }`,
  ].join("\n");
}

/** Generate user prompt: the editor's request + the optional research block. */
export function buildGenerateUserPrompt(
  s: PromptSettings,
  adminPrompt: string,
  research: ResearchResult | null,
): string {
  const today = new Date().toISOString().slice(0, 10);
  const block = research?.context
    ? [
        "\n## VERIFIED WEB RESEARCH (base EVERY concrete fact ONLY on this)",
        research.context,
        `\nReminder: do NOT name or credit any OUTLET from the research; report the underlying fact in ${s.brandName}'s own voice. Official sources (${s.officialSources}) ARE cited.`,
      ].join("\n")
    : "\n(No web research — write as analysis/preview; do not state recent events as fact.)";
  return [
    `Write an article in ${s.writingLanguage} for today (${today}) from the following editor request:`,
    `"""${adminPrompt}"""`,
    block,
    "\nReturn only the JSON.",
  ].join("\n");
}

/**
 * Apply an editor's free-text modification instruction to an existing article.
 * NOT `reviewPost` (which is a strict gate that can REJECT). Mirrors the
 * `callJson` shape (json_object + stripInlineMarkdown on title/excerpt).
 */
export async function refinePost(
  client: OpenAI,
  model: string,
  s: PromptSettings,
  current: GeneratedPost,
  instruction: string,
  context?: ResearchResult | null,
): Promise<GeneratedPost> {
  const system = [
    `You are an editor revising an existing article written in ${s.writingLanguage} for ${s.domainDescription}.`,
    "Apply the editor's modification instruction to the article. Leave everything else intact.",
    "Keep the correct facts; do not invent new data beyond the instruction or the research block.",
    "",
    s.bodyStructureGuide,
    "",
    `Keep the article in ${s.writingLanguage}.`,
    `Return STRICT JSON: { "title": string, "excerpt": string, "content": string (GitHub-Flavored Markdown) }`,
  ].join("\n");

  const research = context?.context
    ? `\n## NEW WEB RESEARCH (use only if the instruction asks for new facts)\n${context.context}\n`
    : "";

  const user = [
    "## CURRENT ARTICLE",
    JSON.stringify(current, null, 2),
    "",
    "## MODIFICATION INSTRUCTION",
    instruction,
    research,
    "Return only the revised JSON.",
  ].join("\n");

  const res = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  if (!parsed.title || !parsed.content) {
    throw new Error("Refine response missing required fields (title, content)");
  }
  return {
    title: stripInlineMarkdown(String(parsed.title)),
    excerpt: stripInlineMarkdown(String(parsed.excerpt ?? "")),
    content: String(parsed.content).trim(),
  };
}
