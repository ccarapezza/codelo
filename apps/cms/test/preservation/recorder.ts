// Cliente de OpenAI falso que graba los mensajes en vez de mandarlos.
//
// No hace falta mockear el módulo para la mayoría de las funciones: reciben el
// `client` por parámetro, así que alcanza con pasarle esto. Las dos que se
// construyen su propio cliente (el redactor y los overlays de Social Studio) se
// capturan aparte, desde sus armadores puros.
//
// La respuesta enlatada es un JSON vacío a propósito: lo que se captura es el
// prompt de ENTRADA. Si la función después falla al parsear la respuesta no
// importa — el mensaje ya quedó grabado. Por eso `capture()` traga el error.

import type OpenAI from "openai";

export type Grabado = { system: string; user: string };

export type Grabador = {
  client: OpenAI;
  /** Todas las llamadas en orden. */
  llamadas: Grabado[];
  /** La última llamada; falla con un mensaje claro si no hubo ninguna. */
  ultima(): Grabado;
};

/**
 * El ÚLTIMO mensaje del rol: en una conversación de varios turnos —la segunda
 * lectura del Director— lo que se congela es el pedido nuevo. En las de un
 * turno, primero y último son el mismo.
 */
function textoDe(mensajes: Array<{ role: string; content: unknown }>, rol: string): string {
  const m = [...mensajes].reverse().find((x) => x.role === rol);
  if (!m) return "";
  return typeof m.content === "string" ? m.content : JSON.stringify(m.content);
}

export function crearGrabador(respuesta = "{}"): Grabador {
  const llamadas: Grabado[] = [];

  const registrar = (req: { messages?: Array<{ role: string; content: unknown }>; n?: number }) => {
    const mensajes = req.messages ?? [];
    llamadas.push({ system: textoDe(mensajes, "system"), user: textoDe(mensajes, "user") });
    return {
      choices: Array.from({ length: Math.max(1, req.n ?? 1) }, () => ({
        message: { content: respuesta },
      })),
    };
  };

  const client = {
    chat: { completions: { create: async (req: never) => registrar(req) } },
    // La API Responses (búsqueda web) usa `input`, no `messages`.
    responses: {
      create: async (req: { instructions?: string; input?: string }) => {
        llamadas.push({ system: req.instructions ?? "", user: req.input ?? "" });
        return { output_text: respuesta };
      },
    },
  } as unknown as OpenAI;

  return {
    client,
    llamadas,
    ultima() {
      const u = llamadas.at(-1);
      if (!u) throw new Error("No se grabó ninguna llamada al modelo.");
      return u;
    },
  };
}

/**
 * Corre `fn` con un cliente grabador y devuelve lo que se le mandó al modelo,
 * ignorando si después explotó parseando la respuesta enlatada.
 */
export async function capture(
  fn: (client: OpenAI) => Promise<unknown>,
  respuesta = "{}",
): Promise<Grabado> {
  const g = crearGrabador(respuesta);
  try {
    await fn(g.client);
  } catch {
    /* lo que importa ya quedó grabado */
  }
  return g.ultima();
}
