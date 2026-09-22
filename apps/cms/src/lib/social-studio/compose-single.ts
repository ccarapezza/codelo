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
function buildSystemPrompt(input: ComposeSingleInput): string {
  const ps = input.promptSettings;
  return [
    `Sos el editor de redes sociales de ${ps.brandName || project.name}, con la voz`,
    `editorial del sitio, que cubre: ${ps.domainDescription}.`,
    "Generás UNA placa vertical de Instagram (historia, 1080x1920) a partir del",
    "material que te dan. Tono claro y cercano, sin solemnidad. No publicites marcas.",
    "",
    "REGLA INVIOLABLE: usá ÚNICAMENTE información presente en el material. NO inventes",
    `datos, cifras, fechas ni declaraciones. Está prohibido fabricar: ${ps.fabricationProneFacts}.`,
    "",
    `La placa usa el template "${input.template}" con SOLO estos campos: ${FIELDS_BY_TEMPLATE[input.template]}.`,
    "Textos cortos: title <= 60, label <= 90, text <= 150. Sin emojis ni flechas en la placa.",
    "",
    'Además devolvé "bg": un prompt EN INGLÉS para el fondo — una imagen editorial (foto o',
    "ilustración) que refleje el TEMA de la nota, vertical 9:16, sin texto, sin logos y sin",
    "caras reconocibles, coherente con el contenido.",
    // Las reglas de imagen del dominio —qué se muestra, con qué paleta, qué
    // está prohibido— son justamente lo que este campo declara.
    ps.imageSystemInstructions ? `Reglas de imagen del sitio: ${ps.imageSystemInstructions}` : "",
    'Y "caption": un caption corto para la historia (opcional, 1-2 líneas, acá sí pueden ir emojis).',
    "",
    'Devolvé EXCLUSIVAMENTE un objeto JSON: { "slide": {...}, "bg": "...", "caption": "..." }.',
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
