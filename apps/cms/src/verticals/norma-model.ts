// Modelo para la lectura de normas del Boletín Oficial.
//
// Vivía en lib/openai-config.ts, que es del motor: el merge de Nib lo borró sin
// conflicto porque codelo nunca había tocado ese archivo desde la base. Acá es
// del vertical, que es donde tiene que estar.
//
// Separado del modelo de texto a propósito: el triage y la ficha se corren
// sobre resoluciones largas con anexos, donde conviene poder subir de modelo
// sin encarecer la generación de artículos (que es mucho más frecuente).
// Vacío → cae al modelo de texto, que es el comportamiento por defecto.

import type { Core } from "@strapi/strapi";
import { getOpenAITextModel } from "../lib/openai-config";

export async function getOpenAINormaModel(strapi: Core.Strapi): Promise<string> {
  try {
    const row = (await strapi.db.query("api::site-setting.site-setting").findOne({})) as {
      openaiNormaModel?: string | null;
    } | null;
    const fromDb = row?.openaiNormaModel?.trim();
    if (fromDb) return fromDb;
  } catch {
    // Sin fila o sin base: cae al env y al modelo de texto.
  }
  const fromEnv = process.env.OPENAI_NORMA_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return getOpenAITextModel(strapi);
}
