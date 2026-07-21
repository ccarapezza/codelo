// Composer: convierte un artículo (Post) en un deck de placas + caption de
// Instagram, usando el text model existente (gpt-4o-mini por defecto).
// Regla central: usar SOLO información del artículo. No inventar datos.

import type OpenAI from "openai";
import { TEMPLATE_NAMES, type Slide, type TemplateName } from "./templates";
import { BRAND } from "./brand";
import type { PromptSettings } from "../prompt-defaults";

export interface ComposeCarouselInput {
  title: string;
  excerpt: string;
  content: string;
  promptSettings: PromptSettings;
}

export interface ComposeCarouselResult {
  slides: Slide[];
  caption: string;
  coverPrompt: string | null;
}

const MAX_CONTENT_CHARS = 6000;

// Límites de longitud por campo para que el texto entre en la placa.
const CAPS: Record<string, number> = {
  kicker: 28,
  title: 70,
  tagline: 90,
  hint: 40,
  label: 110,
  subtitle: 150,
  text: 170,
  by: 40,
  pre: 18,
  unit: 18,
  url: 40,
};

function cut(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max).trim() : s;
}

export function htmlToPlainText(content: string): string {
  return content
    .replace(/<[^>]+>/g, " ") // tags HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // imágenes markdown
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links markdown -> texto
    .replace(/[#>*_`~]/g, " ") // símbolos markdown
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_CONTENT_CHARS);
}

// Toma cada slide crudo del modelo y devuelve un Slide válido (o null si no sirve).
// Exportado: Social Studio lo reusa para sanear slides editados en el preview.
export function sanitizeSlide(raw: unknown): Slide | null {
  if (!raw || typeof raw !== "object") return null;
  let r = raw as Record<string, unknown>;
  let template = r.template as TemplateName;

  // Variante de forma: algunos modelos (gpt-5.x) anidan los campos bajo el
  // NOMBRE del template como clave —  { "cover": { kicker, title, bg, ... } } —
  // en vez de la forma plana { template:"cover", kicker, ... }. Lo desanidamos.
  if (!TEMPLATE_NAMES.includes(template)) {
    const wrapKey = Object.keys(r).find(
      (k) => TEMPLATE_NAMES.includes(k as TemplateName) && r[k] !== null && typeof r[k] === "object",
    );
    if (wrapKey) {
      template = wrapKey as TemplateName;
      r = { template, ...(r[wrapKey] as Record<string, unknown>) };
    }
  }

  // Si sigue inválido (template raro o ausente), lo inferimos por los campos
  // presentes en vez de descartar la placa.
  if (!TEMPLATE_NAMES.includes(template)) {
    if (Array.isArray(r.items)) template = "bullets";
    else if (typeof r.text === "string" && r.text.trim()) template = "quote";
    else if (r.big !== undefined && String(r.big).trim()) template = "stat";
    else if (typeof r.url === "string" && r.url.trim()) template = "cta";
    else if ((typeof r.title === "string" && r.title.trim()) || (typeof r.kicker === "string" && r.kicker.trim())) template = "cover";
    else return null;
  }

  const s: Slide = { template };
  for (const [field, max] of Object.entries(CAPS)) {
    const val = cut(r[field], max);
    if (val !== undefined) (s as unknown as Record<string, unknown>)[field] = val;
  }
  if (r.big !== undefined) s.big = cut(String(r.big), 8) ?? "";
  if (Array.isArray(r.items)) {
    s.items = r.items
      .map((it) => cut(it, 80))
      .filter((x): x is string => Boolean(x))
      .slice(0, 5);
  }
  // Preservar el prompt de fondo de la portada (bg.ai) para que composeCarousel
  // lo use como coverPrompt (antes se descartaba → el cover nunca usaba la
  // escena que pedía el modelo).
  if (r.bg && typeof r.bg === "object" && typeof (r.bg as { ai?: unknown }).ai === "string") {
    s.bg = { ai: (r.bg as { ai: string }).ai };
  }
  return s;
}

function buildSystemPrompt(ps: PromptSettings): string {
  return [
    `Sos el editor de redes sociales de ${ps.brandName}, asociación civil sin fines de lucro.`,
    "Generás un carrusel de Instagram (5 a 7 placas) a partir de un artículo ya publicado.",
    "Voz de marca: divulgación seria y cercana sobre cannabis, cáñamo, salud, derechos y",
    "ambiente. Tono rioplatense, claro, sin solemnidad y sin apología.",
    "",
    "REGLAS DURAS: nunca fomentes el consumo de sustancia alguna, lícita o no; no des",
    "consejo médico ni dosis; no publicites productos, marcas ni comercios.",
    "",
    "REGLA INVIOLABLE (credibilidad): usá ÚNICAMENTE información presente en el artículo.",
    "NO inventes datos, cifras, fechas, resultados ni declaraciones. Está prohibido fabricar:",
    `${ps.fabricationProneFacts}. Si un dato no está en el texto, NO lo incluyas. Es preferible`,
    "una placa menos a una placa con un dato inventado. En 'quote', el texto debe ser textual",
    "del artículo.",
    "",
    "ESTRUCTURA del deck:",
    '- Placa 1 = portada con template "cover": kicker corto, title gancho en una línea, hint "deslizá".',
    '  Incluí en la portada "bg": { "ai": "<prompt EN INGLÉS, fotografía editorial deportiva, sin',
    '  texto, sin logos, sin caras reconocibles>" }.',
    "- Placas intermedias: elegí entre stat (un dato/número fuerte del texto), bullets (2 a 4 puntos),",
    "  quote (una frase textual + autor si aparece).",
    '- Última placa = "cta": title corto, subtitle, url "cogollosdeloeste.com.ar".',
    "",
    `TEMPLATES VÁLIDOS (no inventes otros): ${TEMPLATE_NAMES.join(", ")}.`,
    "",
    'FORMA DE CADA SLIDE — objeto PLANO con un campo "template" y los campos de ese template.',
    'NO anides los campos bajo el nombre del template. Campos por template:',
    "  template=cover  → kicker, title, hint, bg",
    "  template=stat   → kicker, big, label",
    "  template=bullets→ kicker, title, items (array)",
    "  template=quote  → text, by",
    "  template=cta    → title, subtitle, url",
    "Textos cortos: title <= 60, label <= 90, items <= 70 c/u. Sin emojis ni flechas en las placas.",
    "",
    'CAPTION (campo "caption"): texto para el feed de Instagram en rioplatense, con un hook en la',
    'primera línea, 2 a 4 líneas de desarrollo basadas en el artículo, cierre "Link en la bio 👇"',
    "y 8 a 12 hashtags relevantes al tema (cannabis, cáñamo, salud, derechos, ambiente,",
    "según corresponda). Los emojis van solo acá, no en las placas.",
    "",
    "Devolvé EXCLUSIVAMENTE este JSON (placas PLANAS, fijate el ejemplo):",
    '{ "slides": [',
    '  { "template": "cover", "kicker": "...", "title": "...", "hint": "deslizá", "bg": { "ai": "<prompt en inglés>" } },',
    '  { "template": "stat", "kicker": "...", "big": "2-0", "label": "..." },',
    '  { "template": "bullets", "kicker": "...", "title": "...", "items": ["...", "..."] },',
    '  { "template": "cta", "title": "...", "subtitle": "...", "url": "cogollosdeloeste.com.ar" }',
    '], "caption": "..." }',
  ].join("\n");
}

export async function composeCarousel(
  client: OpenAI,
  textModel: string,
  input: ComposeCarouselInput,
): Promise<ComposeCarouselResult> {
  const userPrompt = [
    `Título: ${input.title}`,
    `Resumen: ${input.excerpt || "(sin resumen)"}`,
    "",
    "Artículo (texto plano):",
    htmlToPlainText(input.content || input.excerpt || input.title),
  ].join("\n");

  const completion = await client.chat.completions.create({
    model: textModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(input.promptSettings) },
      { role: "user", content: userPrompt },
    ],
  });

  const rawContent = completion.choices?.[0]?.message?.content ?? "";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`El composer no devolvió JSON válido (modelo ${textModel}): ${rawContent.slice(0, 300)}`);
  }

  // Extracción tolerante: el array de placas puede venir bajo distintas claves
  // (o el objeto entero ser el array) según cómo responda el modelo.
  const slidesRaw: unknown[] = Array.isArray(parsed)
    ? (parsed as unknown[])
    : Array.isArray(parsed.slides)
      ? (parsed.slides as unknown[])
      : Array.isArray(parsed.placas)
        ? (parsed.placas as unknown[])
        : Array.isArray(parsed.cards)
          ? (parsed.cards as unknown[])
          : Array.isArray(parsed.deck)
            ? (parsed.deck as unknown[])
            : [];
  let slides = slidesRaw.map(sanitizeSlide).filter((s): s is Slide => s !== null);

  // La placa 1 es la portada: forzar a "cover" o "hero".
  if (slides.length > 0 && slides[0].template !== "cover" && slides[0].template !== "hero") {
    slides[0] = { ...slides[0], template: "cover" };
  }
  // Clamp a 7 placas; mínimo 3 para que valga como carrusel.
  slides = slides.slice(0, 7);
  if (slides.length < 3) {
    // Incluí la respuesta cruda del modelo para poder diagnosticar desde el
    // propio error del job (se ve en el Studio), sin tener que mirar logs.
    throw new Error(
      `El composer devolvió muy pocas placas (${slides.length}). Modelo: ${textModel}. ` +
        `Respuesta: ${rawContent.slice(0, 400)}`,
    );
  }

  // Extraer el prompt del fondo IA de la portada (solo la portada lleva fondo IA).
  let coverPrompt: string | null = null;
  const cover = slides[0];
  if (cover.bg && typeof cover.bg === "object" && typeof cover.bg.ai === "string") {
    coverPrompt = cover.bg.ai.trim() || null;
  }
  // El render del CMS resuelve el fondo de la portada aparte; las demás placas
  // usan fondo de marca. Limpiamos `bg` para que el render no intente nada raro.
  slides = slides.map((s) => {
    const { bg, _bgUri, ...rest } = s;
    return rest as Slide;
  });

  const caption =
    cut(parsed.caption, 2200) ?? `${input.title}\n\nLink en la bio 👇\n\n#cannabis #canamo #${BRAND.handle.replace(".", "")}`;

  return { slides, caption, coverPrompt };
}
