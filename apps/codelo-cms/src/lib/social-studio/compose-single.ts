// Single-slide composer for the "Historia" format: one LLM call that produces
// ONE slide (template chosen by the user) + optional caption, grounded in the
// article (or in the user's custom brief). Reuses the carousel composer's
// sanitization so field caps stay consistent.
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

function buildSystemPrompt(input: ComposeSingleInput): string {
  return [
    "Sos el editor de redes sociales de Cogollos del Oeste, asociación civil sin fines",
    "de lucro. Generás UNA placa vertical de Instagram (historia, 1080x1920) a partir del",
    "material que te dan. Tono rioplatense, claro, cercano, sin solemnidad ni apología.",
    "Nunca fomentes el consumo, no des dosis ni consejo médico, no publicites marcas.",
    "",
    "REGLA INVIOLABLE: usá ÚNICAMENTE información presente en el material. NO inventes",
    `datos, cifras, fechas ni declaraciones. Está prohibido fabricar: ${input.promptSettings.fabricationProneFacts}.`,
    "",
    `La placa usa el template "${input.template}" con SOLO estos campos: ${FIELDS_BY_TEMPLATE[input.template]}.`,
    "Textos cortos: title <= 60, label <= 90, text <= 150. Sin emojis ni flechas en la placa.",
    "",
    'Además devolvé "bg": un prompt EN INGLÉS para el fondo (fotografía editorial deportiva,',
    "vertical 9:16, sin texto, sin logos, sin caras reconocibles) coherente con el contenido,",
    'y "caption": un caption corto para la historia (opcional, 1-2 líneas, acá sí pueden ir emojis).',
    "",
    'Devolvé EXCLUSIVAMENTE un objeto JSON: { "slide": {...}, "bg": "...", "caption": "..." }.',
  ].join("\n");
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
