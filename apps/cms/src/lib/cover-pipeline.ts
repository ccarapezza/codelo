// La portada de una nota: elegir el prompt, generar la imagen y subirla.
//
// Estaba copiado cuatro veces —el Director, la red de seguridad al publicar,
// la regeneración desde el panel y el editor de notas— y las copias habían
// divergido: sólo dos reintentaban cuando Gemini devuelve un 200 vacío, así que
// el Director publicaba sin imagen en un caso que la regeneración resolvía
// sola. Un vertical que publica por su cuenta (un analista de partidos, un
// lector de normas) usa esto mismo en vez de sumar una quinta copia.
//
// Lo que NO hace, a propósito: escribir la nota ni la auditoría. Cada sitio
// persiste distinto —el Director actualiza y publica; la regeneración
// republica conservando la fecha; el editor ni siquiera tiene nota todavía— y
// registra el éxito después de persistir, con su propio resumen. Si esto
// registrara, la fila de "portada generada" aparecería antes de que la nota
// la tenga.

import type { Core } from "@strapi/strapi";
import type OpenAI from "openai";
import {
  chooseImagePrompt,
  generateCoverImage,
  isOpenRouterModel,
  uploadImageToStrapi,
} from "./openai";
import type { PromptSettings } from "./prompt-defaults";

/** Lo que se lee del agente generador de imágenes. Sin agente, valen los ajustes. */
export type ImageGeneratorAgentDoc = {
  documentId?: string | null;
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
};

/**
 * El agente generador de imágenes activo, o null. Sin agente, la portada sale
 * igual con los ajustes editoriales: la red de seguridad al publicar lo usa así.
 */
export async function findActiveImageGenerator(
  strapi: Core.Strapi,
): Promise<ImageGeneratorAgentDoc | null> {
  const results = await strapi.documents("api::agent.agent").findMany({
    filters: { role: "image-generator", enabled: true },
  });
  return (results[0] as unknown as ImageGeneratorAgentDoc) ?? null;
}

export interface CoverJob {
  /** null en el editor de notas: la nota todavía no existe. */
  documentId: string | null;
  title: string;
  excerpt: string | null;
  /**
   * Semilla del sorteo de tratamiento y escena. Default `documentId|title`.
   * El PRIMER intento la usa tal cual —el Director depende de eso para que una
   * nota salga siempre con la misma portada— y los reintentos le suman
   * `|retry2`, `|retry3`.
   */
  seedKey?: string;
  /** Prompt escrito a mano: se usa tal cual, en un solo intento y sin sorteo. */
  customPrompt?: string | null;
}

export interface CoverContext {
  textClient: OpenAI;
  textModel: string;
  imageModel: string;
  keys: { openaiImageKey?: string; openrouterKey?: string };
  imgAgent: ImageGeneratorAgentDoc | null;
  promptSettings: PromptSettings;
  /**
   * Las descripciones de las últimas portadas, para que la nueva no se les
   * parezca. Si no vienen, se leen las 10 más recientes.
   */
  recentDescriptions?: string[];
  /** Al regenerar, la portada vieja de la misma nota no cuenta como "reciente". */
  excludeDocumentId?: string;
  /** Default 3. Sólo se reintenta ante el 200 vacío de Gemini. */
  maxPromptTries?: number;
  /** Prefijo de los logs, para saber de dónde vino: "[agent-runner]", "[post]". */
  logTag?: string;
}

export interface CoverResult {
  coverImageId: number;
  /** El prompt con el que salió la imagen: se guarda en `post.coverPrompt`. */
  coverPrompt: string;
}

/**
 * Error de la portada con el último prompt elegido, si se llegó a elegir uno.
 * El Director guarda ese prompt aunque la imagen falle: Social Studio lo
 * reusa para los fondos de las placas.
 */
export class CoverPipelineError extends Error {
  constructor(
    message: string,
    readonly prompt: string | null,
    readonly original?: unknown,
  ) {
    super(message);
    this.name = "CoverPipelineError";
  }
}

/** El 200 vacío de Gemini: reintentar el MISMO prompt nunca lo resuelve, otro sí. */
function esImagenVacia(err: unknown): boolean {
  return ((err as Error)?.message ?? "").includes("no inline image data");
}

async function descripcionesRecientes(
  strapi: Core.Strapi,
  excluir: string | undefined,
): Promise<string[]> {
  const recent = (await strapi.documents("api::post.post").findMany({
    filters: {
      coverPrompt: { $notNull: true },
      ...(excluir ? { documentId: { $ne: excluir } } : {}),
    },
    sort: { createdAt: "desc" },
    fields: ["coverPrompt"],
    limit: 10,
  } as never)) as unknown as Array<{ coverPrompt: string | null }>;
  return recent.map((r) => r.coverPrompt!).filter(Boolean);
}

export async function generateCoverForPost(
  strapi: Core.Strapi,
  job: CoverJob,
  ctx: CoverContext,
): Promise<CoverResult> {
  const tag = ctx.logTag ?? "[cover]";
  const custom = job.customPrompt?.trim() || null;
  const maxTries = custom ? 1 : Math.max(1, ctx.maxPromptTries ?? 3);
  const base = job.seedKey ?? `${job.documentId}|${job.title}`;
  const quien = job.documentId ?? job.title;

  const recentDescriptions = custom
    ? []
    : (ctx.recentDescriptions ?? (await descripcionesRecientes(strapi, ctx.excludeDocumentId)));

  let prompt: string | null = null;
  let imagen: Buffer | undefined;
  for (let intento = 1; intento <= maxTries; intento++) {
    try {
      prompt =
        custom ??
        (await chooseImagePrompt(ctx.textClient, ctx.textModel, {
          title: job.title,
          excerpt: job.excerpt ?? "",
          seedKey: intento === 1 ? base : `${base}|retry${intento}`,
          recentDescriptions,
          systemInstructions:
            ctx.imgAgent?.imagePromptTemplate?.trim() || ctx.promptSettings.imageSystemInstructions,
          themeGuide: ctx.promptSettings.imageThemeGuide,
          anchorTaxonomy: ctx.promptSettings.imageAnchorTaxonomy,
          brandPalette: ctx.promptSettings.brandPalette,
        }));
    } catch (err) {
      throw new CoverPipelineError((err as Error).message, prompt, err);
    }

    try {
      imagen = await generateCoverImage(ctx.keys, ctx.imageModel, prompt, {
        size: ctx.imgAgent?.imageSize ?? undefined,
        quality: ctx.imgAgent?.imageQuality ?? undefined,
      });
      break;
    } catch (err) {
      if (!esImagenVacia(err) || intento === maxTries) {
        // El prompt va al log antes de rendirse: un rechazo de moderación es
        // indiagnosticable de otro modo, porque sólo se guarda si sale bien.
        strapi.log.error(`${tag} cover generation failed for ${quien}; prompt was: ${prompt}`);
        throw new CoverPipelineError((err as Error).message, prompt, err);
      }
      strapi.log.warn(
        `${tag} cover image came back empty for ${quien}; regenerating prompt (try ${intento}/${maxTries})`,
      );
    }
  }
  if (!imagen || !prompt) throw new CoverPipelineError("Cover image generation failed after retries.", prompt);

  const ext = isOpenRouterModel(ctx.imageModel) ? "png" : "jpg";
  const nombre = job.documentId ? `cover-${job.documentId}` : "news-cover";
  const coverImageId = await uploadImageToStrapi(
    strapi as Parameters<typeof uploadImageToStrapi>[0],
    imagen,
    `${nombre}-${Date.now()}.${ext}`,
    job.title,
  );
  return { coverImageId, coverPrompt: prompt };
}
