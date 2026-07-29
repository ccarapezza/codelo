// AI provider credentials and model defaults.
// API keys are read from env vars ONLY and never persisted in the DB, to limit
// blast radius if the DB is compromised and to centralize rotation.
// Model *names* (non-secret) are stored in the site-setting single type so they
// can be switched from the admin UI without a redeploy; env vars act as fallback.

type StrapiLike = {
  db: {
    query: (uid: string) => {
      findOne: (params: object) => Promise<Record<string, unknown> | null>;
    };
  };
};

async function readSettingModel(strapi: StrapiLike, field: string): Promise<string | undefined> {
  try {
    const row = await strapi.db.query("api::site-setting.site-setting").findOne({});
    const value = (row?.[field] as string | undefined)?.trim();
    return value || undefined;
  } catch {
    // No row yet / DB unavailable → fall back to env + hardcoded default.
    return undefined;
  }
}

export function getOpenAITextKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  return key;
}

export function getOpenAIImageKey(): string {
  return (
    process.env.OPENAI_IMAGE_API_KEY?.trim() ||
    getOpenAITextKey()
  );
}

export function getOpenRouterImageKey(): string {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured");
  return key;
}

// Precedence: site-setting (DB) → env var → hardcoded fallback.
export async function getOpenAITextModel(strapi: StrapiLike, fallback = "gpt-4o-mini"): Promise<string> {
  const fromDb = await readSettingModel(strapi, "openaiTextModel");
  if (fromDb) return fromDb;
  return process.env.OPENAI_TEXT_MODEL?.trim() || fallback;
}

/**
 * Modelo para la lectura de normas del Boletín Oficial.
 *
 * Separado del modelo de texto a propósito: el triage y la ficha se corren
 * sobre resoluciones largas con anexos, donde conviene poder subir de modelo
 * sin encarecer la generación de artículos (que es mucho más frecuente).
 * Vacío → cae al modelo de texto, que es el comportamiento por defecto.
 */
export async function getOpenAINormaModel(strapi: StrapiLike): Promise<string> {
  const fromDb = await readSettingModel(strapi, "openaiNormaModel");
  if (fromDb) return fromDb;
  const fromEnv = process.env.OPENAI_NORMA_MODEL?.trim();
  if (fromEnv) return fromEnv;
  return getOpenAITextModel(strapi);
}

// Holds an OpenAI (gpt-image-* / dall-e-3) OR an OpenRouter ("google/gemini-*")
// model id; the provider is inferred from the id downstream (see isOpenRouterModel).
export async function getOpenAIImageModel(strapi: StrapiLike, fallback = "gpt-image-1-mini"): Promise<string> {
  const fromDb = await readSettingModel(strapi, "openaiImageModel");
  if (fromDb) return fromDb;
  return process.env.OPENAI_IMAGE_MODEL?.trim() || fallback;
}
