// Lectura asistida por IA de las normas del Boletín Oficial.
//
// Dos trabajos en una sola llamada por norma:
//   1. TRIAGE — un puntaje 0-3 que separa las normas que cambian algo del ruido
//      que entra por coincidencia de palabras (designaciones de personal,
//      licitaciones, edictos que mencionan "cannabis" al pasar). Sin esto, el
//      filtro sigue siendo el AND de strings de itemMatchesTerm().
//   2. FICHA — qué cambia, a quién afecta, desde cuándo y qué hay que hacer,
//      extraído del texto íntegro de la norma.
//
// El resultado se publica al lector, así que la disciplina es la misma que en
// el módulo del INASE: se informa lo que la fuente dice, no se interpreta. Las
// reglas de dominio viven en `boletinAnalysisInstructions` (editable desde el
// admin); acá vive el andamiaje: la forma del JSON y la validación de lo que
// vuelve, que NO se delega al modelo.

import type { Core } from "@strapi/strapi";
import { getOpenAIClient } from "../lib/openai";
import { getOpenAINormaModel, getOpenAITextKey } from "../lib/openai-config";
import { getPromptSettings } from "../lib/prompt-settings";

/** Ficha de una norma, ya validada y lista para persistir. */
export interface NormaAnalisis {
  relevancia: number;
  relevanciaMotivo: string | null;
  organismo: string | null;
  resumen: string | null;
  queCambia: string[];
  aQuienAfecta: string[];
  vigencia: string | null;
  pasos: string[];
  normasCitadas: string[];
}

/**
 * Umbral de publicación y de ingreso al pool del Redactor.
 *
 * 2 = "afecta directamente a alguien del sector". Por debajo la norma se
 * archiva igual (queda consultable y no se vuelve a analizar) pero no se
 * muestra ni se le ofrece al Redactor.
 */
export const RELEVANCIA_MINIMA = 2;

/** Techo del texto que se le manda al modelo. Ver nota en analizarNorma(). */
const MAX_TEXTO_PROMPT = 40000;

// Topes por campo. El modelo respeta los "máximo N" del prompt casi siempre;
// esto es el casi.
const MAX_ITEMS = { queCambia: 5, aQuienAfecta: 4, pasos: 4, normasCitadas: 8 };
const MAX_LEN = { item: 300, resumen: 1200, motivo: 400, corto: 200 };

// ---------------------------------------------------------------------------
// Validación — nunca confiar en la forma del JSON que devuelve el modelo
// ---------------------------------------------------------------------------

function cleanString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // El modelo a veces devuelve el string literal "null" o "N/A" en vez de null.
  if (/^(null|n\/?a|no aplica|sin datos|ninguno?a?)$/i.test(trimmed)) return null;
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen).trimEnd()}…` : trimmed;
}

function cleanList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const item = cleanString(raw, MAX_LEN.item);
    if (!item) continue;
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * Normaliza la respuesta cruda del modelo a una ficha válida.
 *
 * `relevancia` es el único campo obligatorio y se clampea a 0-3: si viene
 * ausente o ilegible se asume 0 (ruido), no un valor del medio. Un puntaje
 * inventado hacia arriba publica basura; hacia abajo sólo deja la norma
 * archivada, que es recuperable.
 *
 * Exportada para poder testearla sin red.
 */
export function normalizeAnalisis(raw: unknown): NormaAnalisis {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const rawRel = typeof obj.relevancia === "string" ? Number(obj.relevancia) : obj.relevancia;
  const relevancia =
    typeof rawRel === "number" && Number.isFinite(rawRel)
      ? Math.min(3, Math.max(0, Math.round(rawRel)))
      : 0;

  return {
    relevancia,
    relevanciaMotivo: cleanString(obj.relevanciaMotivo, MAX_LEN.motivo),
    organismo: cleanString(obj.organismo, MAX_LEN.corto),
    resumen: cleanString(obj.resumen, MAX_LEN.resumen),
    queCambia: cleanList(obj.queCambia, MAX_ITEMS.queCambia),
    aQuienAfecta: cleanList(obj.aQuienAfecta, MAX_ITEMS.aQuienAfecta),
    vigencia: cleanString(obj.vigencia, MAX_LEN.corto),
    pasos: cleanList(obj.pasos, MAX_ITEMS.pasos),
    normasCitadas: cleanList(obj.normasCitadas, MAX_ITEMS.normasCitadas),
  };
}

/**
 * Una ficha con relevancia alta pero sin resumen no sirve para nada: es lo que
 * se muestra al lector y lo que se le pasa al Redactor. Sin él, la norma se
 * trata como si el análisis hubiera fallado y se reintenta al día siguiente.
 */
export function analisisEsUtil(a: NormaAnalisis): boolean {
  return a.relevancia < RELEVANCIA_MINIMA || a.resumen !== null;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

/** Forma del JSON. Fija en código: si el modelo renombra un campo, se descarta. */
const JSON_SHAPE = [
  "Devolvé JSON ESTRICTO con exactamente esta forma:",
  "{",
  '  "relevancia": number (0, 1, 2 o 3),',
  '  "relevanciaMotivo": string,',
  '  "organismo": string | null,',
  '  "resumen": string | null,',
  '  "queCambia": string[],',
  '  "aQuienAfecta": string[],',
  '  "vigencia": string | null,',
  '  "pasos": string[],',
  '  "normasCitadas": string[]',
  "}",
  "Sin markdown, sin comentarios, sin campos extra. Las listas vacías van como [], no como null.",
].join("\n");

export function buildAnalisisPrompt(
  instrucciones: string,
  norma: { titulo: string; norma?: string | null; rubro?: string | null; texto: string },
): { system: string; user: string } {
  return {
    system: [
      "Sos un analista que lee normas del Boletín Oficial de la República Argentina para una asociación civil, y produce una ficha de lectura para el público general.",
      "",
      instrucciones,
      "",
      JSON_SHAPE,
    ].join("\n"),
    user: [
      norma.rubro ? `RUBRO: ${norma.rubro}` : null,
      norma.norma ? `IDENTIFICACIÓN: ${norma.norma}` : null,
      `TÍTULO: ${norma.titulo}`,
      "",
      "TEXTO DE LA NORMA:",
      norma.texto.slice(0, MAX_TEXTO_PROMPT),
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

// ---------------------------------------------------------------------------
// Llamada
// ---------------------------------------------------------------------------

/**
 * Analiza una norma. Lanza si la llamada falla — el llamador decide si eso
 * deja la fila en "error" (y se reintenta mañana) o si aborta la corrida.
 *
 * El texto se recorta a MAX_TEXTO_PROMPT: las resoluciones con anexos de
 * cientos de páginas existen, y la parte que importa (VISTO, CONSIDERANDO y
 * los ARTÍCULOS) está siempre al principio — los anexos son planillas.
 */
export async function analizarNorma(
  strapi: Core.Strapi,
  norma: { titulo: string; norma?: string | null; rubro?: string | null; texto: string },
): Promise<{ analisis: NormaAnalisis; modelo: string }> {
  const client = getOpenAIClient(getOpenAITextKey());
  const modelo = await getOpenAINormaModel(strapi);
  const settings = await getPromptSettings(strapi);

  const { system, user } = buildAnalisisPrompt(settings.boletinAnalysisInstructions, norma);

  const response = await client.chat.completions.create({
    model: modelo,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("El modelo no devolvió JSON válido");
  }

  return { analisis: normalizeAnalisis(parsed), modelo };
}
