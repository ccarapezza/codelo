// Composer: convierte un artículo (Post) en un deck de placas + caption de
// Instagram, usando el text model existente (gpt-4o-mini por defecto).
// Regla central: usar SOLO información del artículo. No inventar datos.

import type OpenAI from "openai";
import { TEMPLATE_NAMES, type Slide, type TemplateName } from "./templates";
import type { PromptSettings } from "../prompt-defaults";
import * as project from "../project";

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

/**
 * Exportado para poder compararlo sin red (test/preservation).
 *
 * ⚠️ Nada de acá puede describir un tema, una regla editorial, una paleta ni un
 * dominio: el motor no sabe de qué habla el sitio que lo usa. Todo eso entra por
 * `ps`. Esta función llegó a tener escrita la voz de marca, las reglas de
 * consumo, la paleta y hasta los hashtags de UN proyecto, y se los aplicaba a
 * todos: un portal publicaba sus placas con los hashtags de OTRO tema.
 */
export function buildCarouselSystemPrompt(ps: PromptSettings, siteUrl: string): string {
  return [
    `Sos el editor de redes sociales de ${ps.brandName}.`,
    "Generás un carrusel de Instagram (5 a 7 placas) a partir de un artículo ya publicado.",
    ps.socialVoice,
    "",
    "REGLA INVIOLABLE (credibilidad): usá ÚNICAMENTE información presente en el artículo.",
    "NO inventes datos, cifras, fechas, resultados ni declaraciones. Está prohibido fabricar:",
    `${ps.fabricationProneFacts}. Si un dato no está en el texto, NO lo incluyas. Es preferible`,
    "una placa menos a una placa con un dato inventado. En 'quote', el texto debe ser textual",
    "del artículo.",
    "",
    "ESTRUCTURA del deck:",
    '- Placa 1 = portada con template "cover": kicker corto, title gancho en una línea, hint "deslizá".',
    '  Incluí en la portada "bg": { "ai": "<prompt EN INGLÉS para una imagen editorial (foto o ilustración)',
    `  ${ps.socialCoverStyle}>" }.`,
    "- Placas intermedias: elegí entre stat (un dato/número fuerte del texto), bullets (2 a 4 puntos),",
    "  quote (una frase textual + autor si aparece).",
    `- Última placa = "cta": title corto, subtitle, url "${siteUrl}".`,
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
    // El dialecto y el tono los pone `socialVoice`, arriba: acá iba "en
    // rioplatense" fijo, que es una suposición sobre el país del lector.
    'CAPTION (campo "caption"): texto para el feed de Instagram, con un hook en la',
    'primera línea, 2 a 4 líneas de desarrollo basadas en el artículo, cierre "Link en la bio 👇"',
    ps.socialHashtags
      ? `y 8 a 12 hashtags relevantes al tema (${ps.socialHashtags}, según corresponda).`
      : "y 8 a 12 hashtags relevantes al tema de la nota.",
    "Los emojis van solo acá, no en las placas.",
    "",
    "Devolvé EXCLUSIVAMENTE este JSON (placas PLANAS, fijate el ejemplo):",
    '{ "slides": [',
    '  { "template": "cover", "kicker": "...", "title": "...", "hint": "deslizá", "bg": { "ai": "<prompt en inglés>" } },',
    '  { "template": "stat", "kicker": "...", "big": "27%", "label": "..." },',
    '  { "template": "bullets", "kicker": "...", "title": "...", "items": ["...", "..."] },',
    `  { "template": "cta", "title": "...", "subtitle": "...", "url": "${siteUrl}" }`,
    '], "caption": "..." }',
  ].join("\n");
}

/**
 * El caption que se usa si el modelo no devuelve uno.
 *
 * El handle sale de los ajustes y puede estar vacío: una instancia sin redes no
 * tiene que imprimir el `#` de nadie. Antes esto terminaba, fijo, en
 * los hashtags de un tema concreto — para cualquier proyecto.
 */
/**
 * El dominio que se imprime en la placa de cierre.
 *
 * Sale de la URL pública de la instalación y ya no de `${BRAND.handle}.com.ar`,
 * que además de ser de un proyecto le agregaba un `.com.ar` a cualquier handle
 * — un portal terminaba mostrando un dominio que no existe.
 */
function siteHost(): string {
  try {
    return new URL(project.siteUrl).host.replace(/^www\./, "");
  } catch {
    return project.siteUrl;
  }
}

export function fallbackCaption(ps: PromptSettings, title: string): string {
  const tags = ps.socialHashtags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((t) => `#${t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "")}`);
  if (ps.socialHandle) tags.push(`#${ps.socialHandle.replace(/[^a-zA-Z0-9]/g, "")}`);
  const cierre = tags.length > 0 ? `\n\n${tags.join(" ")}` : "";
  return `${title}\n\nLink en la bio 👇${cierre}`;
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
      { role: "system", content: buildCarouselSystemPrompt(input.promptSettings, siteHost()) },
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

  const caption = cut(parsed.caption, 2200) ?? fallbackCaption(input.promptSettings, input.title);

  return { slides, caption, coverPrompt };
}
