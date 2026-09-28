// Single-slide composer for the "Historia" format: one LLM call that produces
// ONE slide (template chosen by the user) + optional caption, grounded in the
// article (or in the user's custom brief). Reuses the carousel composer's
// sanitization so field caps stay consistent.
import * as project from "../project";
import type OpenAI from "openai";
import { sanitizeSlide, htmlToPlainText } from "../social-cards/composer";
import type { Slide } from "../social-cards/templates";
import type { PromptSettings } from "../prompt-defaults";

export interface ComposeSingleInput {
  title: string;
  excerpt: string;
  content: string;
  template: "cover" | "stat" | "quote" | "countdown";
  promptSettings: PromptSettings;
}

export interface ComposeSingleResult {
  slide: Slide;
  caption: string | null;
  coverPrompt: string | null;
}

const FIELDS_BY_TEMPLATE: Record<ComposeSingleInput["template"], string> = {
  cover: "cover{kicker,title,hint}",
  stat: "stat{kicker,big,label}",
  quote: "quote{text,by}",
  countdown: "countdown{pre,big,unit,label}",
};

// ⚠️ Nada de lo que hay acá puede describir un tema, una regla editorial o una
// paleta concretas: el motor no sabe de qué habla el sitio que lo usa. Todo eso
// entra por `promptSettings`, que el proyecto define en sus prompt-defaults y
// el admin deja editar.
//
// Esta función llegó a tener escritas las reglas y la paleta de UN proyecto, y
// se las aplicaba a todos. Además la extracción había cortado la primera frase
// al medio y dejaba colgado un "de lucro." suelto, que viajaba al modelo en
// cada llamada.
export function buildSystemPrompt(input: ComposeSingleInput): string {
  const ps = input.promptSettings;
  return [
    `You are the social-media editor for ${ps.brandName || project.name}, a site covering:`,
    `${ps.domainDescription}.`,
    ps.socialVoice,
    "You produce ONE vertical Instagram card (story, 1080x1920) from the material given to you.",
    "",
    "UNBREAKABLE RULE: use ONLY information present in the material. Do NOT invent",
    `data, figures, dates or statements. It is forbidden to fabricate: ${ps.fabricationProneFacts}.`,
    "",
    `The card uses the "${input.template}" template with ONLY these fields: ${FIELDS_BY_TEMPLATE[input.template]}.`,
    "Short texts: title <= 60, label <= 90, text <= 150. No emojis or arrows on the card.",
    "",
    `All card text and the caption must be written in ${ps.writingLanguage}.`,
    'Also return "bg": a prompt IN ENGLISH for the background — an editorial image (photo or',
    "illustration) reflecting the TOPIC of the article, vertical 9:16, no text, no logos and no",
    "recognisable faces, coherent with the content.",
    // Las reglas de imagen del dominio —qué se muestra, con qué paleta, qué
    // está prohibido— son justamente lo que este campo declara.
    ps.imageSystemInstructions ? `Site image rules: ${ps.imageSystemInstructions}` : "",
    'And "caption": a short caption for the story (optional, 1-2 lines; emojis are allowed here).',
    "",
    'Return EXCLUSIVELY a JSON object: { "slide": {...}, "bg": "...", "caption": "..." }.',
  ]
    .filter(Boolean)
    .join("\n");
}

export async function composeSingleSlide(
  client: OpenAI,
  textModel: string,
  input: ComposeSingleInput,
): Promise<ComposeSingleResult> {
  const userPrompt = [
    `Título: ${input.title}`,
    `Resumen: ${input.excerpt || "(sin resumen)"}`,
    "",
    "Material (texto plano):",
    htmlToPlainText(input.content || input.excerpt || input.title),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: textModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(input) },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content ?? "";
  let parsed: { slide?: unknown; bg?: unknown; caption?: unknown };
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`El composer de historia no devolvió JSON válido: ${rawContent.slice(0, 200)}`);
  }

  const slide = sanitizeSlide({ ...(parsed.slide as object), template: input.template });
  if (!slide) throw new Error("El composer de historia devolvió una placa inválida.");

  const coverPrompt = typeof parsed.bg === "string" && parsed.bg.trim() ? parsed.bg.trim() : null;
  const caption =
    typeof parsed.caption === "string" && parsed.caption.trim() ? parsed.caption.trim().slice(0, 500) : null;

  return { slide, caption, coverPrompt };
}
