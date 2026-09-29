// La guarda del Director: lo que el revisor afirma sobre la evidencia se
// verifica en código antes de dar por bueno un rechazo.
//
// Existe por un error de LECTURA, no de criterio. Visto en producción el
// 29/09/2026, con la evidencia completa en el prompt: el Director rechazó una
// nota porque una frase "no estaba en ninguna fuente", y estaba textual en el
// resumen de la [1], a mitad de camino entre otros hechos; en otra negó un dato
// que dos fuentes decían literalmente. Otro recordatorio en el prompt no lo
// arregla —es un modelo leyendo un prompt largo—, así que el Director cita cada
// afirmación que da por ausente y el motor la busca en la evidencia que él
// mismo tuvo delante. Si aparece, se le pide UNA segunda lectura mostrándole
// dónde.
//
// El motor no aprueba nada por su cuenta. Encontrar las palabras no prueba que
// la fuente diga lo mismo —puede cambiar un número o una negación—, así que lo
// único que hace es mostrárselo: el veredicto sigue siendo del Director. Un
// falso positivo de la búsqueda cuesta una llamada; uno del Director costaba
// una nota.

import type OpenAI from "openai";
import { reviewPost, type ReviewPostInput, type ReviewResult } from "./openai";
import type { PromptSettings } from "./prompt-defaults";
import { STOPWORDS } from "./headline-similarity";
import { REVIEW_SUMMARY_MAX, type SourceItem } from "./source-context";

/** Un bloque de evidencia tal como lo leyó el Director, con la etiqueta que lo nombra en su prompt. */
export type EvidenceItem = { label: string; text: string };

/** Una afirmación que el Director dio por ausente y el motor encontró en la evidencia. */
export type ClaimMatch = { claim: string; label: string; excerpt: string };

/**
 * Cuántas frases puede quitar el Director y aun así publicar. Más que eso, lo
 * que queda no es una nota con un detalle de más: es relleno sin fuente.
 */
export const MAX_REMOVED_CLAIMS = 3;

/** Las que se buscan por rechazo. Un rechazo con veinte afirmaciones no es un error de lectura. */
const MAX_CLAIMS = 5;
/** Con menos palabras significativas que esto, cualquier texto las "contiene". */
const MIN_TOKENS = 2;
/** Contexto a cada lado de lo encontrado, para que el Director lo lea en su frase. */
const MARGEN = 80;

type Token = { stem: string; start: number; end: number };

// Números con separador de miles ("6.000", "27.350"), decimales ("2,5") y
// palabras. Misma normalización que el anti-calco —minúsculas, sin acentos,
// prefijo de 6 letras, sin palabras funcionales— con una diferencia: los
// números se conservan enteros, porque acá son justamente el dato. Una nota que
// dice 3 donde la fuente dice 2 no está "en la fuente".
const TOKEN = /\d{1,3}(?:[.,]\d{3})+(?!\d)|\d+(?:[.,]\d+)?|[\p{L}\p{M}]+/gu;

function tokens(texto: string): Token[] {
  const out: Token[] = [];
  for (const m of texto.matchAll(TOKEN)) {
    const crudo = m[0];
    const start = m.index ?? 0;
    let stem: string;
    if (/^\d/.test(crudo)) {
      stem = /^\d{1,3}(?:[.,]\d{3})+$/.test(crudo) ? crudo.replace(/[.,]/g, "") : crudo.replace(",", ".");
    } else {
      const palabra = crudo.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
      if (palabra.length < 3 || STOPWORDS.has(palabra)) continue;
      stem = palabra.slice(0, 6);
    }
    out.push({ stem, start, end: start + crudo.length });
  }
  return out;
}

/** Las palabras significativas de una afirmación, sin repetir, en orden. */
export function claimStems(claim: string): string[] {
  return [...new Set(tokens(claim).map((t) => t.stem))];
}

/**
 * Todas las palabras de la afirmación (o el 80 % si son más de cuatro) dentro
 * de una ventana corta del texto. La ventana es lo que impide que un texto
 * largo —los apuntes de una investigación— "contenga" cualquier frase por
 * tener sus palabras desparramadas en párrafos distintos.
 */
function buscar(
  claim: readonly string[],
  texto: readonly Token[],
): { hits: number; from: number; to: number } | null {
  const hacenFalta = claim.length <= 4 ? claim.length : Math.ceil(claim.length * 0.8);
  const ventana = claim.length * 2 + 4;
  const buscadas = new Set(claim);
  let mejor: { hits: number; from: number; to: number } | null = null;
  for (let i = 0; i < texto.length; i++) {
    if (!buscadas.has(texto[i].stem)) continue;
    const vistas = new Set<string>();
    let ultimo = i;
    for (let j = i; j < Math.min(texto.length, i + ventana); j++) {
      const s = texto[j].stem;
      if (buscadas.has(s) && !vistas.has(s)) {
        vistas.add(s);
        ultimo = j;
      }
    }
    if (vistas.size >= hacenFalta && (!mejor || vistas.size > mejor.hits)) {
      mejor = { hits: vistas.size, from: i, to: ultimo };
      if (mejor.hits === claim.length) break;
    }
  }
  return mejor;
}

/** Lo encontrado con algo de contexto a cada lado, sin cortar palabras. */
function recorte(texto: string, desde: number, hasta: number): string {
  let a = Math.max(0, desde - MARGEN);
  let b = Math.min(texto.length, hasta + MARGEN);
  if (a > 0) {
    const k = texto.slice(a, desde).search(/\s/);
    a = k === -1 ? desde : a + k + 1;
  }
  if (b < texto.length) {
    const cola = texto.slice(hasta, b);
    const k = Math.max(cola.lastIndexOf(" "), cola.lastIndexOf("\n"));
    b = k === -1 ? hasta : hasta + k;
  }
  // El salto separa el título de la fuente de su resumen: queda visible.
  const cuerpo = texto
    .slice(a, b)
    .replace(/\s*\n\s*/g, " / ")
    .replace(/\s+/g, " ")
    .trim();
  return `${a > 0 ? "…" : ""}${cuerpo}${b < texto.length ? "…" : ""}`;
}

/**
 * Las afirmaciones que el Director dio por ausentes y SÍ están en la
 * evidencia, con el bloque y el fragmento donde aparecen. Una por afirmación:
 * la primera coincidencia en el orden en que él lee (apuntes, fuentes del
 * Redactor, contexto adicional).
 */
export function findClaimsInEvidence(
  claims: readonly string[],
  evidence: readonly EvidenceItem[],
): ClaimMatch[] {
  const bloques = evidence.map((e) => ({ ...e, tokens: tokens(e.text) }));
  const out: ClaimMatch[] = [];
  for (const claim of claims.slice(0, MAX_CLAIMS)) {
    const stems = claimStems(claim);
    if (stems.length < MIN_TOKENS) continue;
    for (const b of bloques) {
      const m = buscar(stems, b.tokens);
      if (!m) continue;
      out.push({
        claim,
        label: b.label,
        excerpt: recorte(b.text, b.tokens[m.from].start, b.tokens[m.to].end),
      });
      break;
    }
  }
  return out;
}

/**
 * La evidencia del Director como bloques buscables, con las MISMAS etiquetas y
 * los MISMOS cortes que su prompt: apuntes, fuentes del Redactor [1..k] y
 * contexto adicional [k+1..]. El resumen de `extraNews` llega ya recortado,
 * igual que en el bloque que se le muestra.
 */
export function buildReviewEvidence(input: {
  researchNotes?: string | null;
  writerSources: readonly SourceItem[];
  extraNews?: readonly { source: string; title: string; summary: string }[];
}): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const apuntes = input.researchNotes?.trim();
  if (apuntes) out.push({ label: "the RESEARCH NOTES", text: apuntes });
  input.writerSources.forEach((s, i) =>
    out.push({
      label: `source [${i + 1}] ${s.source}`,
      text: `${s.title}\n${s.summary.slice(0, REVIEW_SUMMARY_MAX)}`,
    }),
  );
  const k = input.writerSources.length;
  (input.extraNews ?? []).forEach((n, i) =>
    out.push({ label: `source [${k + i + 1}] ${n.source}`, text: `${n.title}\n${n.summary}` }),
  );
  return out;
}

/** El pedido de la segunda lectura: qué encontró el motor y cómo leerlo. */
export function buildRecheckPrompt(found: readonly ClaimMatch[]): string {
  return [
    `## SECOND READING — the engine checked your "unsupportedClaims" against the evidence`,
    "",
    "You rejected this draft saying these claims appear in no source. The engine searched the",
    "evidence you were given and found their words in it:",
    "",
    ...found.flatMap((m, i) => [`${i + 1}. Your claim: "${m.claim}"`, `   In ${m.label}: «${m.excerpt}»`]),
    "",
    "Read each excerpt LITERALLY, word by word:",
    "- If it states your claim, the claim IS supported: it is no ground to reject, nor to delete.",
    "- If it differs in a detail that changes the fact (a number, a date, a name, who did what,",
    `  a negation), the claim is still unsupported: keep it in "unsupportedClaims" and say in`,
    `  "reason" what differs.`,
    "",
    "Then review the draft again from the top, with every rule above, and return the JSON (either schema).",
  ].join("\n");
}

export type ReviewOutcome = {
  result: ReviewResult;
  /**
   * Si hubo segunda lectura: qué encontró el motor y qué había dicho el
   * Director antes. `error` si la relectura falló y quedó el primer veredicto.
   */
  recheck: { found: ClaimMatch[]; firstReason: string; error?: string } | null;
};

/**
 * La revisión con la guarda: si el Director rechaza por afirmaciones que el
 * motor encuentra en la evidencia, se le pide una segunda lectura —una sola—
 * y vale lo que diga ahí.
 */
export async function reviewWithRecheck(
  client: OpenAI,
  model: string,
  settings: PromptSettings,
  input: ReviewPostInput,
  evidence: readonly EvidenceItem[],
): Promise<ReviewOutcome> {
  const first = await reviewPost(client, model, settings, input);
  if (first.rejected !== true) return { result: first, recheck: null };
  const found = findClaimsInEvidence(first.unsupportedClaims, evidence);
  if (found.length === 0) return { result: first, recheck: null };
  try {
    const second = await reviewPost(client, model, settings, input, {
      previous: { reason: first.reason, unsupportedClaims: first.unsupportedClaims },
      prompt: buildRecheckPrompt(found),
    });
    return { result: second, recheck: { found, firstReason: first.reason } };
  } catch (err) {
    // La relectura es una mejora sobre lo que había: si falla, vale el primer
    // rechazo, como antes de que existiera. Dejar que el error suba perdía
    // también ese veredicto, y el borrador volvía al pool en cada corrida
    // pagando las dos llamadas de nuevo.
    return {
      result: first,
      recheck: { found, firstReason: first.reason, error: (err as Error).message },
    };
  }
}

/**
 * El tope de recortes, aplicado en código: el prompt lo pide, pero un modelo
 * que quita cinco frases y aprueba está publicando una nota que era, en buena
 * parte, relleno sin fuente. Se trata como un rechazo, con las frases a la
 * vista para quien la quiera rescatar.
 */
export function enforceRemovalCap(result: ReviewResult, max = MAX_REMOVED_CLAIMS): ReviewResult {
  // `=== true` y no `if (result.rejected)`: con `strict: false` TypeScript no
  // estrecha la unión por el lado del `false`.
  if (result.rejected === true || result.removedClaims.length <= max) return result;
  const n = result.removedClaims.length;
  return {
    rejected: true,
    reason:
      `El Director quitó ${n} frases sin respaldo en las fuentes y el tope es ${max}: ` +
      `demasiado para publicarla recortada. Frases quitadas: ` +
      result.removedClaims.map((f) => `«${f}»`).join(" · "),
    unsupportedClaims: result.removedClaims,
  };
}
