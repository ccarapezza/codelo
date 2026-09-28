// Investigación en la web para el Explorador.
//
// El resto del motor escribe SOBRE LO QUE LLEGA por RSS: si ningún feed lo
// publicó, no existe. Eso deja afuera todo lo que no es estricta actualidad —
// una nota de color, una explicación, un aniversario, un tema que el sector
// conoce y los feeds no cubrieron esta semana— y ata el volumen del sitio al
// caudal de sus fuentes. Con feeds lentos, el redactor no escribe nada.
//
// Acá el agente elige el tema y sale a buscarlo. Se usa la herramienta
// `web_search` de la Responses API de OpenAI, que además de responder devuelve
// ANOTACIONES con la URL de cada página que consultó: esas URLs son las que se
// guardan como evidencia del borrador, así el Director lo revisa con el mismo
// criterio que a cualquier otro y la Auditoría sigue pudiendo contestar de
// dónde salió cada dato.
//
// ⚠️ No es gratis: cada corrida es una llamada con búsqueda web, más cara que
// una completion normal. Por eso el Explorador se corre a mano o por schedule
// espaciado, no en cada ciclo de RSS.

import { esUrlPublica } from "./url-guard";
import type { SourceItem } from "./source-context";

const RESPONSES_API = "https://api.openai.com/v1/responses";

export type Investigacion = {
  /** El ángulo concreto que el agente decidió cubrir. */
  tema: string;
  /** Los hechos que encontró, con su atribución, para que el redactor escriba. */
  apuntes: string;
  /** Las páginas que consultó, listas para guardar como evidencia. */
  fuentes: SourceItem[];
};

/** Texto plano de la respuesta, juntando todos los bloques. */
function textoDe(json: unknown): string {
  const salida = (json as { output?: unknown[] })?.output;
  if (!Array.isArray(salida)) return "";
  const partes: string[] = [];
  for (const bloque of salida) {
    const contenido = (bloque as { content?: unknown[] })?.content;
    if (!Array.isArray(contenido)) continue;
    for (const c of contenido) {
      const t = (c as { text?: unknown })?.text;
      if (typeof t === "string") partes.push(t);
    }
  }
  return partes.join("\n").trim();
}

/**
 * Las páginas citadas, deduplicadas por URL.
 *
 * OpenAI le agrega `?utm_source=openai` a cada cita: se saca, porque esa URL se
 * publica como fuente de la nota y no tiene por qué llevar nuestro rastreo.
 *
 * Exportada para poder testearla sin red.
 */
export function fuentesDeAnotaciones(json: unknown): SourceItem[] {
  const salida = (json as { output?: unknown[] })?.output;
  if (!Array.isArray(salida)) return [];
  const porUrl = new Map<string, SourceItem>();

  for (const bloque of salida) {
    const contenido = (bloque as { content?: unknown[] })?.content;
    if (!Array.isArray(contenido)) continue;
    for (const c of contenido) {
      const anots = (c as { annotations?: unknown[] })?.annotations;
      if (!Array.isArray(anots)) continue;
      for (const a of anots) {
        const url = (a as { url?: unknown })?.url;
        if (typeof url !== "string") continue;
        let limpia: string;
        try {
          const u = new URL(url);
          u.searchParams.delete("utm_source");
          limpia = u.href;
        } catch {
          continue;
        }
        if (!esUrlPublica(limpia) || porUrl.has(limpia)) continue;
        const titulo = (a as { title?: unknown })?.title;
        let host = limpia;
        try {
          host = new URL(limpia).host.replace(/^www\./, "");
        } catch {
          /* ya validada arriba */
        }
        porUrl.set(limpia, {
          title: typeof titulo === "string" && titulo.trim() ? titulo.trim().slice(0, 300) : host,
          source: host,
          url: limpia,
          summary: "",
        });
      }
    }
  }
  return [...porUrl.values()];
}

/**
 * Elige un ángulo dentro del área del agente y lo investiga.
 *
 * `evitar` son los títulos ya publicados: sin eso el modelo propone siempre el
 * tema más obvio del área y el sitio repite.
 */
export async function investigar(opts: {
  apiKey: string;
  model: string;
  /** De qué habla el sitio, para que el ángulo tenga sentido editorial. */
  dominio: string;
  /** El área del agente: «vinos y bodegas», «cocina de autor». */
  area: string;
  /** Instrucciones propias del agente sobre qué tipo de nota busca. */
  instrucciones: string;
  idioma: string;
  evitar: string[];
  timeoutMs?: number;
}): Promise<Investigacion | null> {
  const evitarLista = opts.evitar.length
    ? `\n\nYA PUBLICAMOS ESTO — elegí otro ángulo, no una variación:\n${opts.evitar
        .slice(0, 25)
        .map((t) => `- ${t}`)
        .join("\n")}`
    : "";

  const instruccion = [
    `Sos el investigador de ${opts.dominio}.`,
    `Tu área es: ${opts.area}.`,
    opts.instrucciones ? `\nQué clase de nota buscás:\n${opts.instrucciones}` : "",
    evitarLista,
    "",
    "PASO 1 — Elegí UN ángulo concreto y acotado dentro de tu área. No tiene por qué ser",
    "noticia de hoy: puede ser una explicación, un oficio, una historia, una tendencia o un",
    "dato que al lector le sirva. Sí tiene que ser algo verificable en fuentes públicas.",
    "",
    "PASO 2 — Buscá en la web y leé al menos tres fuentes distintas y confiables.",
    "",
    "PASO 3 — Escribí APUNTES, no una nota. Hechos concretos, cada uno con quién lo dice:",
    "cifras, fechas, nombres propios con su cargo, citas textuales. Si algo lo afirma una sola",
    "fuente, decilo. Si no pudiste verificar algo, no lo pongas.",
    "",
    `Escribí los apuntes en ${opts.idioma}.`,
    "",
    "Empezá con una línea exactamente así:",
    "TEMA: <el ángulo elegido, en una frase>",
    "y después los apuntes.",
  ]
    .filter(Boolean)
    .join("\n");

  let json: unknown;
  try {
    const res = await fetch(RESPONSES_API, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        tools: [{ type: "web_search" }],
        // ⚠️ `tool_choice` OBLIGATORIO. Ofrecerle la herramienta no alcanza:
        // medido el 24/09/2026 con gpt-4o-mini, ante una consigna corta y
        // directa el modelo busca, pero ante estas instrucciones de tres pasos
        // devuelve sólo un bloque `message` —contesta de memoria— y la
        // respuesta viene sin una sola anotación. Sin anotaciones no hay
        // fuentes que citar, y el Explorador descarta la corrida entera. Con
        // `required` aparece el `web_search_call` y las citas vienen.
        tool_choice: "required",
        input: instruccion,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120000),
    });
    if (!res.ok) {
      const detalle = await res.text().catch(() => "");
      throw new Error(`web_search HTTP ${res.status}: ${detalle.slice(0, 300)}`);
    }
    json = await res.json();
  } catch (err) {
    throw new Error(`La investigación web falló: ${(err as Error).message}`);
  }

  const texto = textoDe(json);
  if (!texto) return null;

  const m = texto.match(/^\s*TEMA:\s*(.+)$/im);
  const tema = m ? m[1].trim() : "";
  const apuntes = texto.replace(/^\s*TEMA:.*$/im, "").trim();
  const fuentes = fuentesDeAnotaciones(json);

  // Sin fuentes citadas no hay nada que el Director pueda verificar, y una nota
  // así es exactamente lo que este motor no quiere publicar.
  if (fuentes.length === 0 || !apuntes) return null;

  return { tema: tema || apuntes.slice(0, 120), apuntes, fuentes };
}
