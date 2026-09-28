// Despertar un trabajo de otro servicio por su endpoint interno.
//
// Un vertical con un servicio propio al lado del CMS —un ingestor de datos, un
// sincronizador— lo dispara desde sus crons con esto, en vez de escribir otra
// vez el mismo fetch. Es fire-and-forget: se espera el acuse, no el trabajo.
//
// El contrato es el de los servicios de la casa: POST a
// `<baseUrl>/internal/jobs/<job>` con la clave compartida en `x-internal-key`.

import type { Core } from "@strapi/strapi";

export type InternalJobOutcome = "dispatched" | "skipped" | "failed";

/**
 * Falla suave, siempre: un servicio caído no puede tumbar el cron que lo llama.
 * Sin `baseUrl` o sin `apiKey` no se intenta nada (`skipped`, con un aviso),
 * que es lo que pasa en un entorno local sin el servicio levantado.
 */
export async function triggerInternalJob(
  strapi: Core.Strapi,
  opts: { baseUrl?: string | null; apiKey?: string | null; job: string; timeoutMs?: number },
): Promise<InternalJobOutcome> {
  const { job, timeoutMs = 5000 } = opts;
  const baseUrl = opts.baseUrl?.trim().replace(/\/$/, "");
  if (!baseUrl) {
    strapi.log.warn(`[internal-jobs] "${job}" salteado: falta la URL del servicio`);
    return "skipped";
  }
  if (!opts.apiKey) {
    strapi.log.warn(`[internal-jobs] "${job}" salteado: falta INTERNAL_API_KEY`);
    return "skipped";
  }

  const url = `${baseUrl}/internal/jobs/${job}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-internal-key": opts.apiKey, "content-type": "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      strapi.log.error(`[internal-jobs] "${job}" respondió ${res.status} ${res.statusText}`);
      return "failed";
    }
    strapi.log.info(`[internal-jobs] "${job}" despachado (HTTP ${res.status})`);
    return "dispatched";
  } catch (err) {
    strapi.log.error(`[internal-jobs] "${job}" no se pudo despachar:`, err);
    return "failed";
  }
}
