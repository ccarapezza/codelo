// Procedencia de un borrador: qué noticias tenía a la vista el Redactor cuando
// lo escribió.
//
// Existe porque el Director revisaba contra un contexto RECONSTRUIDO —volvía a
// consultar news-context por palabras clave del título— y la fuente real casi
// nunca aparecía ahí. Medido en producción el 04/08/2026: la consulta del
// Director toma toda palabra de más de 3 letras del título+excerpt, así que
// entra "para", que matcheaba 4.931 de las 17.335 filas del pool; con el
// `limit: 300` ordenado por fecha, su evidencia efectiva eran las últimas
// DOS HORAS de RSS. Un borrador cuya fuente se capturó días antes era
// imposible de verificar, y el Director lo rechazaba por "hechos no
// respaldados" — rechazó el 100 % de las notas entre el 31/07 y el 04/08.
//
// La respuesta es no reconstruir nada: se guarda la evidencia con el borrador y
// el Director revisa contra ESO. Si una afirmación no está en lo que el
// Redactor vio, entonces sí es inventada, y ese es exactamente el juicio que el
// Director tiene que hacer.
//
// Es una FOTO, no una referencia: `news-context` se poda a los 7 días y hay
// borradores que esperan más que eso en el pool. Guardar sólo la URL habría
// dejado sin fuente justo a los borradores más viejos, que son los que más
// necesitan defenderse.

import type { NewsItem } from "./rss-fetcher";

export type SourceItem = {
  title: string;
  source: string;
  url: string;
  summary: string;
};

/** Tope de ítems guardados. El Redactor ve como mucho 10 en modo libre. */
const MAX_ITEMS = 10;
/** Tope por resumen. Suficiente para los hechos; no guarda la nota entera. */
const MAX_SUMMARY = 800;

/**
 * Varios feeds (Revista THC, El Planteo) mandan como `summary` un bloque
 * `<a><img></a>` con el thumbnail y ningún hecho adentro. Sin limpiarlo, la
 * evidencia del borrador es una etiqueta de imagen: el revisor no encuentra el
 * hecho por ningún lado y rechaza igual, que es exactamente lo que se está
 * tratando de arreglar. Cuando no queda texto, el título de la nota es la
 * evidencia — y suele alcanzar, porque los titulares sí traen el hecho.
 */
function stripHtml(s: string): string {
  return s
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'");
}

function clean(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const trimmed = stripHtml(value).replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** Arma la foto de la evidencia para guardar en el borrador. */
export function buildSourceContext(items: readonly NewsItem[]): SourceItem[] {
  const out: SourceItem[] = [];
  const seen = new Set<string>();
  for (const item of items ?? []) {
    const url = clean(item?.url, 500);
    const title = clean(item?.title, 300);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title,
      source: clean(item?.source, 120) || "fuente desconocida",
      url,
      summary: clean(item?.summary, MAX_SUMMARY),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Lee el campo `json` de un borrador.
 *
 * Defensivo a propósito: es una columna JSON libre y los borradores viejos
 * —todos los anteriores a este cambio— la tienen en null. Cualquier cosa
 * inesperada resuelve en lista vacía y el Director cae al camino anterior.
 */
export function parseSourceContext(raw: unknown): SourceItem[] {
  if (!Array.isArray(raw)) return [];
  const out: SourceItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const url = clean(e.url, 500);
    const title = clean(e.title, 300);
    if (!url || !title) continue;
    out.push({
      title,
      source: clean(e.source, 120) || "fuente desconocida",
      url,
      summary: clean(e.summary, MAX_SUMMARY),
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Renderiza la evidencia para el prompt de revisión.
 *
 * Se le dan 600 caracteres por ítem, contra los 300 del contexto de relleno:
 * es la fuente sobre la que se decide publicar o descartar, así que conviene
 * que entre el hecho completo y no sólo la bajada.
 */
export function formatSourceContext(items: readonly SourceItem[], startIndex = 1): string {
  return items
    .map((n, i) => `[${startIndex + i}] ${n.source} | ${n.title}\n${n.summary.slice(0, 600)}`)
    .join("\n");
}
