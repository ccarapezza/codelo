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
            "Sos un investigador de noticias. Buscá en la web los hechos más " +
            "recientes y verificables sobre el pedido del usuario. Respondé SOLO con un " +
            "briefing breve en texto plano de los hechos concretos (qué pasó, quién, " +
            "cuándo, resultado, declaraciones textuales si las hay), con su contexto. " +
            "NO escribas un artículo: solo los hechos. No menciones ni atribuyas a ningún " +
            "medio; reportá el hecho de fondo.",
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
    `Sos un periodista que escribe en ${s.writingLanguage} para ${s.domainDescription}.`,
    "La nota se genera a partir del prompt manual de un editor (y opcionalmente de una investigación web).",
    `Voz: editorial propia de ${s.brandName}, independiente y con criterio, sin grandilocuencia.`,
    "",
    "## REGLAS FACTUALES (duras)",
    `- NUNCA inventes ${s.fabricationProneFacts}. Si un dato no está en el bloque de investigación ni en el pedido del editor, no lo afirmes como hecho.`,
    "- Si no hay bloque de investigación, escribí en clave de análisis/preview, sin afirmar eventos recientes como hechos.",
    "",
    "## REGLAS DE TÍTULO",
    "- Un solo hecho concreto, literal, sin clickbait. No debe contradecir el cuerpo.",
    "",
    s.bodyStructureGuide,
    "",
    `Devolvé STRICT JSON: { "title": string, "excerpt": string (1-2 oraciones), "content": string (Markdown GitHub-Flavored, ~500-650 palabras) }`,
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
        "\n## INVESTIGACIÓN WEB VERIFICADA (basá CADA hecho concreto SOLO en esto)",
        research.context,
        `\nRecordatorio: NO nombres ni atribuyas a ningún MEDIO de la investigación; reportá el hecho de fondo con voz propia de ${s.brandName}. Las fuentes OFICIALES (Boletín Oficial, normas, reguladores, revistas científicas) sí se citan.`,
      ].join("\n")
    : "\n(Sin investigación web — escribí en clave análisis/preview; no afirmes eventos recientes como hechos.)";
  return [
    `Escribí una nota en ${s.writingLanguage} para hoy (${today}) a partir del siguiente pedido del editor:`,
    `"""${adminPrompt}"""`,
    block,
    "\nDevolvé solo el JSON.",
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
    `Sos un editor que revisa una nota existente en ${s.writingLanguage} para ${s.domainDescription}.`,
    "Aplicá la instrucción de modificación del editor a la nota. Mantené intacto todo lo demás.",
    "Conservá los hechos correctos; no inventes datos nuevos más allá de la instrucción o del bloque de investigación.",
    "",
    s.bodyStructureGuide,
    "",
    `Devolvé STRICT JSON: { "title": string, "excerpt": string, "content": string (Markdown GitHub-Flavored) }`,
  ].join("\n");

  const research = context?.context
    ? `\n## NUEVA INVESTIGACIÓN WEB (usar solo si la instrucción pide hechos nuevos)\n${context.context}\n`
    : "";

  const user = [
    "## NOTA ACTUAL",
    JSON.stringify(current, null, 2),
    "",
    "## INSTRUCCIÓN DE MODIFICACIÓN",
    instruction,
    research,
    "Devolvé solo el JSON revisado.",
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
