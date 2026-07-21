import type { Core } from "@strapi/strapi";
import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { logAgentAction } from "../../../lib/audit";
import { republishPreservingDate } from "../../../lib/post-publish";
import { chooseImagePrompt, generateCoverImage, generatePost, getOpenAIClient, isOpenRouterModel, uploadImageToStrapi } from "../../../lib/openai";
import { makeSlug } from "../../../lib/agent-runner";
import {
  researchWithWebSearch,
  buildNewsSystemPrompt,
  buildGenerateUserPrompt,
  refinePost,
} from "../../../lib/news-generator";
import {
  getOpenRouterImageKey,
  getOpenAIImageKey,
  getOpenAIImageModel,
  getOpenAITextKey,
  getOpenAITextModel,
} from "../../../lib/openai-config";
import { getPromptSettings } from "../../../lib/prompt-settings";
import type { PromptSettings } from "../../../lib/prompt-defaults";
import { ensurePostTranslation } from "../../../lib/translate-post";
import { generateOpenRouterImage } from "../../../lib/openrouter-image";
import { composeCarousel, dataUriFromBuffer, renderSlide, renderToPng, SIZES, type Slide } from "../../../lib/social-cards";

type ImageGeneratorAgentDoc = {
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
};

type PostRow = {
  documentId: string;
  title: string;
  excerpt: string | null;
  publishedAt: string | null;
};

function verifyInternalKey(ctx: any): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = ctx.request.headers["x-internal-key"];
  return typeof provided === "string" && provided === expected;
}

// Shared helper: regenerate cover for ONE post. Both the admin endpoint
// (generateCover) and the internal batch endpoint (regenerateCoverInternal)
// dispatch through this so the pipeline stays in a single place.
async function regenerateCoverFor(
  strapi: any,
  documentId: string,
  imgAgent: ImageGeneratorAgentDoc,
  textModel: string,
  imageModel: string,
  textKey: string,
  imageKey: string,
  openrouterKey: string | undefined,
  promptSettings: PromptSettings,
): Promise<void> {
  // Strapi 5's documents API defaults to status: "draft". To learn whether
  // this post has a live published version (and therefore whether we should
  // republish after updating), query the "published" status explicitly.
  const post = (await strapi.documents("api::post.post").findOne({
    documentId,
    populate: ["coverImage"],
  })) as PostRow | null;
  if (!post) {
    strapi.log.warn(`[post] regenerate cover: post ${documentId} not found`);
    return;
  }

  const textClient = getOpenAIClient(textKey);

  // Pull the last 10 cover prompts (excluding this post's own) for memory.
  const recent = (await strapi.documents("api::post.post").findMany({
    filters: { coverPrompt: { $notNull: true }, documentId: { $ne: documentId } },
    sort: { createdAt: "desc" },
    fields: ["coverPrompt"],
    limit: 10,
  })) as unknown as Array<{ coverPrompt: string | null }>;
  const recentDescriptions = recent.map((r) => r.coverPrompt!).filter(Boolean);

  // Some generated prompts make the Gemini image model return an empty 200
  // deterministically (no image, no error) — retrying the same text never
  // recovers. So if the image comes back empty, regenerate a FRESH prompt
  // (different seed → different composition) and try again.
  let imagePrompt = "";
  let imageBuffer: Buffer | undefined;
  const MAX_PROMPT_TRIES = 3;
  // El seedKey lleva un componente que cambia en cada corrida. Antes era
  // `documentId|title|tryN`: como ninguno de los tres varía entre regeneradas,
  // el hash daba siempre el mismo número y por lo tanto SIEMPRE el mismo
  // tratamiento visual para esa nota. Regenerar una portada devolvía otra
  // escena, sí, pero eternamente linograbado (o eternamente foto).
  // El hash sigue repartiendo parejo entre notas; lo que se pierde es la
  // reproducibilidad por nota, que acá no aporta: regenerar ES pedir otra.
  const rotation = Date.now();
  for (let tryN = 1; tryN <= MAX_PROMPT_TRIES; tryN++) {
    imagePrompt = await chooseImagePrompt(textClient, textModel, {
      title: post.title,
      excerpt: post.excerpt ?? "",
      seedKey: `${documentId}|${post.title}|${rotation}|${tryN}`,
      recentDescriptions,
      systemInstructions: imgAgent.imagePromptTemplate?.trim() || promptSettings.imageSystemInstructions,
      themeGuide: promptSettings.imageThemeGuide,
      anchorTaxonomy: promptSettings.imageAnchorTaxonomy,
    });
    try {
      imageBuffer = await generateCoverImage({ openaiImageKey: imageKey, openrouterKey }, imageModel, imagePrompt, {
        size: imgAgent.imageSize ?? undefined,
        quality: imgAgent.imageQuality ?? undefined,
      });
      break;
    } catch (err) {
      const empty = ((err as Error).message ?? "").includes("no inline image data");
      if (!empty || tryN === MAX_PROMPT_TRIES) {
        // Log the offending prompt before giving up: a moderation rejection is
        // otherwise undiagnosable, since the prompt is only persisted on success.
        strapi.log.error(`[post] cover generation failed for ${documentId}; prompt was: ${imagePrompt}`);
        throw err;
      }
      strapi.log.warn(
        `[post] cover image came back empty for ${documentId}; regenerating prompt (try ${tryN}/${MAX_PROMPT_TRIES})`,
      );
    }
  }
  if (!imageBuffer) throw new Error("Cover image generation failed after retries.");
  const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
  const filename = `cover-${documentId}-${Date.now()}.${ext}`;
  const newImageId = await uploadImageToStrapi(strapi, imageBuffer, filename, post.title);

  await strapi.documents("api::post.post").update({
    documentId,
    data: { coverImage: newImageId, coverPrompt: imagePrompt },
  });
  await republishPreservingDate(strapi, documentId);
  strapi.log.info(`[post] cover regenerated for: ${post.title}`);
  await logAgentAction(strapi, {
    agentRole: "image-generator",
    action: "cover_manual",
    agentName: "Image Generator",
    postDocumentId: documentId,
    postTitle: post.title,
    summary: `Generador de Imágenes regeneró cover para: "${post.title}" (manual)`,
    metadata: { model: imageModel, trigger: "admin" },
  });
}

async function loadImageAgentOrThrow(strapi: any): Promise<ImageGeneratorAgentDoc> {
  const imgAgents = await strapi.documents("api::agent.agent").findMany({
    filters: { role: "image-generator", enabled: true },
  });
  const imgAgent = (imgAgents[0] as unknown as ImageGeneratorAgentDoc) ?? null;
  if (!imgAgent) throw new Error("No image-generator agent enabled.");
  return imgAgent;
}

// Image model for carousel backgrounds: always via OpenRouter so we can request
// a 9:16 portrait aspect ratio. Configurable via env, independent of the cover model.
const CAROUSEL_IMAGE_MODEL = process.env.OPENROUTER_IMAGE_MODEL?.trim() || "google/gemini-2.5-flash-image";

// Shared helper: build the full Instagram carousel for ONE post. Compose the deck
// from the article (LLM, strictly grounded), render each slide with satori/resvg,
// upload to the Media Library, and store the plan + caption on the post.
async function buildCarouselFor(
  strapi: any,
  documentId: string,
  textModel: string,
  textKey: string,
  openrouterKey: string,
  promptSettings: PromptSettings,
): Promise<void> {
  const post = (await strapi.documents("api::post.post").findOne({
    documentId,
    fields: ["title", "excerpt", "content", "publishedAt"],
  })) as { title: string; excerpt: string | null; content: string | null } | null;
  if (!post) {
    strapi.log.warn(`[post] carousel: post ${documentId} not found`);
    return;
  }

  // 1) Compose the deck strictly from the article content.
  const client = getOpenAIClient(textKey);
  const { slides, caption, coverPrompt } = await composeCarousel(client, textModel, {
    title: post.title,
    excerpt: post.excerpt ?? "",
    content: post.content ?? "",
    promptSettings,
  });

  // 2) AI background ONLY for the cover (slide 0); the rest use brand backgrounds.
  if (coverPrompt) {
    try {
      const bg = await generateOpenRouterImage(openrouterKey, CAROUSEL_IMAGE_MODEL, coverPrompt, {
        aspectRatio: "9:16",
        imageSize: "1K",
      });
      slides[0]._bgUri = dataUriFromBuffer(bg, "image/png");
    } catch (err) {
      strapi.log.warn(`[post] carousel cover background failed (${documentId}): ${(err as Error).message}`);
    }
  }

  // 3) Render + upload each slide sequentially (keeps the memory pool stable).
  const uploadIds: number[] = [];
  const planSlides: Array<{ index: number; uploadId: number; slide: Slide }> = [];
  for (let i = 0; i < slides.length; i++) {
    const png = await renderToPng(renderSlide(slides[i], SIZES.portrait), SIZES.portrait);
    const n = String(i + 1).padStart(2, "0");
    const filename = `slide-${n}-${documentId}-${Date.now()}.png`;
    const uploadId = await uploadImageToStrapi(strapi, png, filename, `${post.title} — placa ${i + 1}`);
    uploadIds.push(uploadId);
    const { _bgUri, ...slideForPlan } = slides[i];
    void _bgUri;
    planSlides.push({ index: i, uploadId, slide: slideForPlan as Slide });
  }

  // 4) Persist on the post. carouselPlan holds the canonical order because a
  // media "multiple" field does not guarantee order on re-read.
  const carouselPlan = {
    size: SIZES.portrait,
    caption,
    generatedAt: new Date().toISOString(),
    slides: planSlides,
  };
  await strapi.documents("api::post.post").update({
    documentId,
    data: { socialCards: uploadIds, carouselPlan, socialCaption: caption },
  });
  await republishPreservingDate(strapi, documentId);
  strapi.log.info(`[post] carousel generated (${slides.length} slides) for: ${post.title}`);
  await logAgentAction(strapi, {
    agentRole: "image-generator",
    action: "carousel_manual",
    agentName: "Social Cards",
    postDocumentId: documentId,
    postTitle: post.title,
    summary: `Carrusel generado (${slides.length} placas) para: "${post.title}"`,
    metadata: { slides: slides.length, model: CAROUSEL_IMAGE_MODEL, trigger: "admin" },
  });
}


/** Etiqueta tal como la espera la web (ver mapTags en apps/codelo-web/lib/cms.ts). */
type TagShape = { name: string; slug: string; kind: string; reference?: string | null };

/**
 * Adjunta las etiquetas a una respuesta ya sanitizada de `find`/`findOne`.
 * Una sola consulta para todos los posts de la página, no una por post.
 */
async function attachTags(
  strapi: Core.Strapi,
  ctx: { query?: Record<string, unknown> },
  response: { data?: unknown },
): Promise<void> {
  const rows = Array.isArray(response?.data)
    ? (response.data as Array<Record<string, unknown>>)
    : response?.data
      ? [response.data as Record<string, unknown>]
      : [];
  const ids = rows.map((r) => r.documentId).filter((v): v is string => typeof v === "string");
  if (ids.length === 0) return;

  // Se respetan locale y status del pedido original: si no, una home en `es`
  // recibiría las etiquetas de la versión borrador o de otro idioma.
  const status = ctx.query?.status === "draft" ? "draft" : "published";
  const locale = typeof ctx.query?.locale === "string" ? ctx.query.locale : undefined;

  try {
    const withTags = (await strapi.documents("api::post.post").findMany({
      filters: { documentId: { $in: ids } },
      populate: { tags: { fields: ["name", "slug", "kind", "reference"] } },
      status,
      ...(locale ? { locale } : {}),
      limit: ids.length,
    })) as unknown as Array<{ documentId: string; tags?: TagShape[] }>;

    const byDoc = new Map(withTags.map((p) => [p.documentId, p.tags ?? []]));
    for (const row of rows) {
      row.tags = byDoc.get(row.documentId as string) ?? [];
    }
  } catch (err) {
    // Falla suave: sin etiquetas la home pierde las secciones por área, pero
    // el listado de notas sigue funcionando.
    strapi.log.warn(`[post] No se pudieron adjuntar las etiquetas: ${(err as Error).message}`);
  }
}

/** Lee `filters[tags][slug][$eq]=x` (o `filters[tags][slug]=x`) si vino. */
function readTagSlugFilter(ctx: { query?: Record<string, unknown> }): string | null {
  const filters = ctx.query?.filters as Record<string, unknown> | undefined;
  const tags = filters?.tags as Record<string, unknown> | undefined;
  const slug = tags?.slug;
  if (typeof slug === "string") return slug;
  const eq = (slug as Record<string, unknown> | undefined)?.$eq;
  return typeof eq === "string" ? eq : null;
}

/**
 * Listado filtrado por etiqueta, servido por el Document Service.
 *
 * Devuelve la MISMA forma que `super.find` (`{ data, meta.pagination }`) para
 * que la web no tenga que distinguir de dónde viene la respuesta.
 */
async function findByTag(
  strapi: Core.Strapi,
  ctx: { query?: Record<string, unknown> },
  tagSlug: string,
): Promise<{ data: unknown[]; meta: { pagination: { page: number; pageSize: number; total: number } } }> {
  const q = ctx.query ?? {};
  const pag = (q.pagination ?? {}) as Record<string, unknown>;
  const pageSize = Math.min(Math.max(Number(pag.pageSize) || 25, 1), 100);
  const locale = typeof q.locale === "string" ? q.locale : undefined;
  const status = q.status === "draft" ? ("draft" as const) : ("published" as const);

  try {
    const rows = (await strapi.documents("api::post.post").findMany({
      filters: { tags: { slug: tagSlug } },
      populate: {
        tags: { fields: ["name", "slug", "kind", "reference"] },
        coverImage: true,
      },
      sort: { publishedAt: "desc" },
      status,
      ...(locale ? { locale } : {}),
      limit: pageSize,
    })) as unknown as unknown[];

    return {
      data: rows,
      meta: { pagination: { page: 1, pageSize, total: rows.length } },
    };
  } catch (err) {
    strapi.log.warn(`[post] Filtro por etiqueta "${tagSlug}" falló: ${(err as Error).message}`);
    return { data: [], meta: { pagination: { page: 1, pageSize, total: 0 } } };
  }
}

export default factories.createCoreController("api::post.post", ({ strapi }) => ({
  /**
   * `find` y `findOne` propios que reinyectan las etiquetas.
   *
   * Las rutas públicas de post declaran `auth: false` para saltear la cadena de
   * users-permissions. El efecto colateral es que el sanitizador de Strapi 5
   * DESCARTA las relaciones a otros content-types: `tags` no vuelve vacío,
   * vuelve ausente, con cualquier sintaxis de populate, en ambas direcciones y
   * con o sin token. `coverImage` sobrevive porque es media, no una relación a
   * content-type. Verificado también contra `generatedByAgent`, que falla igual.
   *
   * En vez de desnormalizar la etiqueta en un campo string, se resuelve acá: se
   * consultan las etiquetas por separado con el Document Service —que no pasa
   * por ese sanitizador— y se adjuntan al resultado ya sanitizado. El modelo
   * relacional queda intacto y la web sigue leyendo `post.tags` como siempre.
   */
  async find(ctx) {
    // Filtering by the `tags` relation is rejected by Strapi's query validator
    // ("Invalid key tags") for the same reason populate was: these routes are
    // auth:false, so the relation is not in the permitted query shape. Same fix
    // as attachTags — serve the filtered list from the Document Service, which
    // is not subject to that validator.
    const tagSlug = readTagSlugFilter(ctx);
    if (tagSlug) return findByTag(strapi, ctx, tagSlug);

    const response = await super.find(ctx);
    await attachTags(strapi, ctx, response);
    return response;
  },

  async findOne(ctx) {
    const response = await super.findOne(ctx);
    await attachTags(strapi, ctx, response);
    return response;
  },

  // Admin endpoint — single post, fire-and-forget, returns 202 immediately.
  async generateCover(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.request.body as { documentId?: string };
    if (!documentId) return ctx.badRequest("documentId is required");

    let textKey: string;
    let imageKey: string;
    try {
      textKey = getOpenAITextKey();
      imageKey = getOpenAIImageKey();
    } catch (err) {
      strapi.log.error(`[post] generateCover missing OPENAI_API_KEY: ${(err as Error).message}`);
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }

    let imgAgent: ImageGeneratorAgentDoc;
    try {
      imgAgent = await loadImageAgentOrThrow(strapi);
    } catch (err) {
      return ctx.badRequest((err as Error).message);
    }

    const textModel = await getOpenAITextModel(strapi);
    const imageModel = await getOpenAIImageModel(strapi);
    const promptSettings = await getPromptSettings(strapi);

    let openrouterKey: string | undefined;
    if (isOpenRouterModel(imageModel)) {
      try {
        openrouterKey = getOpenRouterImageKey();
      } catch {
        return ctx.badRequest("OpenRouter API key not configured (set OPENROUTER_API_KEY env var).");
      }
    }

    (async () => {
      try {
        await regenerateCoverFor(strapi, documentId, imgAgent, textModel, imageModel, textKey, imageKey, openrouterKey, promptSettings);
      } catch (err) {
        strapi.log.error(`[post] generateCover failed for ${documentId}:`, err);
        await logAgentAction(strapi, {
          agentRole: "image-generator",
          action: "cover_failed",
          agentName: "Image Generator",
          postDocumentId: documentId,
          summary: `Generador de Imágenes falló cover para post ${documentId.slice(0, 8)} (manual)`,
          metadata: { error: (err as Error).message, trigger: "admin" },
        });
      }
    })();

    ctx.body = { ok: true };
  },

  // Admin endpoint — generate the Instagram carousel for ONE post.
  // Fire-and-forget: returns 202 immediately; the heavy work runs in background.
  async generateCarousel(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.request.body as { documentId?: string };
    if (!documentId) return ctx.badRequest("documentId is required");

    let textKey: string;
    let openrouterKey: string;
    try {
      textKey = getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }
    try {
      openrouterKey = getOpenRouterImageKey();
    } catch {
      return ctx.badRequest("OpenRouter API key not configured (set OPENROUTER_API_KEY env var).");
    }

    const textModel = await getOpenAITextModel(strapi);
    const promptSettings = await getPromptSettings(strapi);

    (async () => {
      try {
        await buildCarouselFor(strapi, documentId, textModel, textKey, openrouterKey, promptSettings);
      } catch (err) {
        strapi.log.error(`[post] generateCarousel failed for ${documentId}:`, err);
        await logAgentAction(strapi, {
          agentRole: "image-generator",
          action: "carousel_failed",
          agentName: "Social Cards",
          postDocumentId: documentId,
          summary: `Carrusel falló para post ${documentId.slice(0, 8)} (manual)`,
          metadata: { error: (err as Error).message, trigger: "admin" },
        });
      }
    })();

    ctx.body = { ok: true };
  },

  // Admin endpoint — (re)translate ONE post to English. force=true overwrites
  // an existing English localization. Fire-and-forget, returns 202 immediately.
  async translate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId, force } = ctx.request.body as { documentId?: string; force?: boolean };
    if (!documentId) return ctx.badRequest("documentId is required");

    try {
      getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }

    (async () => {
      try {
        const outcome = await ensurePostTranslation(strapi, documentId, {
          force: force ?? true,
          trigger: "admin",
        });
        strapi.log.info(`[post] translate ${documentId}: ${outcome}`);
      } catch (err) {
        strapi.log.error(`[post] translate failed for ${documentId}:`, err);
      }
    })();

    ctx.body = { ok: true };
  },

  // Admin endpoint — backfill English translations for published Spanish posts
  // that don't have one yet. Sequential to respect OpenAI rate limits.
  // Fire-and-forget: returns the scheduled count immediately; progress lands in
  // the server log and the audit trail (post_translated / translation_failed).
  async translateBackfill(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const body = (ctx.request.body ?? {}) as { limit?: number };
    const limit = Math.min(Math.max(body.limit ?? 20, 1), 100);

    try {
      getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }

    const candidates = (await strapi.documents("api::post.post").findMany({
      locale: "es",
      status: "published",
      sort: { publishedAt: "desc" },
      fields: ["documentId", "title"],
      populate: { localizations: { fields: ["locale", "publishedAt"] } },
      limit: 500,
    } as never)) as unknown as Array<{
      documentId: string;
      title: string;
      localizations?: Array<{ locale: string; publishedAt: string | null }>;
    }>;

    const pending = candidates
      .filter((p) => !p.localizations?.some((l) => l.locale === "en" && l.publishedAt))
      .slice(0, limit);

    if (pending.length === 0) {
      ctx.body = { ok: true, scheduled: 0, note: "all published posts already translated" };
      return;
    }

    (async () => {
      strapi.log.info(`[post] translate backfill: starting ${pending.length} post(s)`);
      let done = 0;
      let failed = 0;
      for (const post of pending) {
        try {
          const outcome = await ensurePostTranslation(strapi, post.documentId, {
            trigger: "backfill",
          });
          if (outcome === "translated") done++;
        } catch (err) {
          failed++;
          strapi.log.error(`[post] backfill translate failed for ${post.documentId}:`, err);
        }
      }
      strapi.log.info(`[post] translate backfill done: ${done} translated, ${failed} failed`);
    })();

    ctx.body = { ok: true, scheduled: pending.length };
  },

  // Internal batch endpoint — accepts { documentIds: string[] } OR
  // { onlyMissing: true, limit?: number } to regenerate covers for published
  // posts that don't yet have one. Authenticated via x-internal-key.
  // Fire-and-forget: returns 202 with the scheduled count immediately.
  async regenerateCoverInternal(ctx) {
    if (!verifyInternalKey(ctx)) return ctx.unauthorized();

    const body = (ctx.request.body ?? {}) as {
      documentIds?: string[];
      onlyMissing?: boolean;
      limit?: number;
    };

    let textKey: string;
    let imageKey: string;
    try {
      textKey = getOpenAITextKey();
      imageKey = getOpenAIImageKey();
    } catch {
      return ctx.badRequest("OPENAI_API_KEY not configured.");
    }

    let imgAgent: ImageGeneratorAgentDoc;
    try {
      imgAgent = await loadImageAgentOrThrow(strapi);
    } catch (err) {
      return ctx.badRequest((err as Error).message);
    }

    let documentIds: string[] = body.documentIds ?? [];
    if (documentIds.length === 0) {
      const limit = Math.min(Math.max(body.limit ?? 50, 1), 100);
      const filters: Record<string, unknown> = {};
      if (body.onlyMissing) filters.coverImage = { $null: true };
      // Status "published" is required to target live posts — Strapi 5's
      // documents API defaults to "draft" which has publishedAt === null.
      const posts = (await strapi.documents("api::post.post").findMany({
        filters,
        status: "published",
        sort: { createdAt: "desc" },
        fields: ["documentId"],
        limit,
      })) as unknown as Array<{ documentId: string }>;
      documentIds = posts.map((p) => p.documentId);
    }

    if (documentIds.length === 0) {
      ctx.body = { ok: true, scheduled: 0, note: "no posts matched" };
      return;
    }

    const textModel = await getOpenAITextModel(strapi);
    const imageModel = await getOpenAIImageModel(strapi);
    const promptSettings = await getPromptSettings(strapi);

    let openrouterKey: string | undefined;
    if (isOpenRouterModel(imageModel)) {
      try {
        openrouterKey = getOpenRouterImageKey();
      } catch {
        return ctx.badRequest("OpenRouter API key not configured (set OPENROUTER_API_KEY env var).");
      }
    }

    // Sequential to keep memory pool stable and avoid OpenAI rate limits.
    (async () => {
      strapi.log.info(`[post] batch regenerate covers: starting ${documentIds.length} posts`);
      let done = 0;
      let failed = 0;
      for (const id of documentIds) {
        try {
          await regenerateCoverFor(strapi, id, imgAgent, textModel, imageModel, textKey, imageKey, openrouterKey, promptSettings);
          done++;
        } catch (err) {
          failed++;
          strapi.log.error(`[post] batch regenerate failed for ${id}:`, err);
        }
      }
      strapi.log.info(`[post] batch regenerate covers done: ${done} OK, ${failed} failed`);
    })();

    ctx.body = { ok: true, scheduled: documentIds.length };
  },

  // ───────── Manual news generator (admin "Generador de notas") ─────────
  // Synchronous (the UI awaits the result), unlike the fire-and-forget endpoints
  // above. Paths are mounted at /news-generator/* in routes/01-admin.ts.

  // POST /news-generator/generate { prompt, webSearch? } -> { title, excerpt, content, sources }
  async newsGenerate(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { prompt, webSearch } = ctx.request.body as { prompt?: string; webSearch?: boolean };
    if (!prompt?.trim()) return ctx.badRequest("prompt is required");

    let textKey: string;
    try {
      textKey = getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }
    const model = await getOpenAITextModel(strapi);
    const settings = await getPromptSettings(strapi);
    const client = getOpenAIClient(textKey);

    try {
      const research = webSearch ? await researchWithWebSearch(client, model, prompt) : null;
      const generated = await generatePost(
        client,
        model,
        buildNewsSystemPrompt(settings),
        buildGenerateUserPrompt(settings, prompt, research),
      );
      ctx.body = { ...generated, sources: research?.sources ?? [] };
    } catch (err) {
      strapi.log.error("[post] newsGenerate failed:", err);
      return ctx.internalServerError("Failed to generate article.");
    }
  },

  // POST /news-generator/refine { current, instruction, webSearch? } -> { title, excerpt, content }
  async newsRefine(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { current, instruction, webSearch } = ctx.request.body as {
      current?: { title?: string; excerpt?: string; content?: string };
      instruction?: string;
      webSearch?: boolean;
    };
    if (!current?.title || !current?.content) return ctx.badRequest("current article is required");
    if (!instruction?.trim()) return ctx.badRequest("instruction is required");

    let textKey: string;
    try {
      textKey = getOpenAITextKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }
    const model = await getOpenAITextModel(strapi);
    const settings = await getPromptSettings(strapi);
    const client = getOpenAIClient(textKey);

    try {
      const research = webSearch ? await researchWithWebSearch(client, model, instruction) : null;
      const refined = await refinePost(
        client,
        model,
        settings,
        { title: current.title, excerpt: current.excerpt ?? "", content: current.content },
        instruction,
        research,
      );
      ctx.body = refined;
    } catch (err) {
      strapi.log.error("[post] newsRefine failed:", err);
      return ctx.internalServerError("Failed to refine article.");
    }
  },

  // POST /news-generator/image { title, excerpt, customPrompt? } -> { mediaId, url, prompt }
  async newsImage(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { title, excerpt, customPrompt } = ctx.request.body as {
      title?: string;
      excerpt?: string;
      customPrompt?: string;
    };
    if (!title?.trim()) return ctx.badRequest("title is required");

    let textKey: string;
    let imageKey: string;
    try {
      textKey = getOpenAITextKey();
      imageKey = getOpenAIImageKey();
    } catch {
      return ctx.badRequest("OpenAI API key not configured (set OPENAI_API_KEY env var).");
    }
    const textModel = await getOpenAITextModel(strapi);
    const imageModel = await getOpenAIImageModel(strapi);
    const settings = await getPromptSettings(strapi);

    let openrouterKey: string | undefined;
    if (isOpenRouterModel(imageModel)) {
      try {
        openrouterKey = getOpenRouterImageKey();
      } catch {
        return ctx.badRequest("OpenRouter API key not configured (set OPENROUTER_API_KEY env var).");
      }
    }

    // Use the configured image-generator agent; fall back to vertical defaults
    // (size/quality/system instructions) when none is enabled.
    let imgAgent: ImageGeneratorAgentDoc;
    try {
      imgAgent = await loadImageAgentOrThrow(strapi);
    } catch {
      imgAgent = { imagePromptTemplate: null, imageSize: null, imageQuality: null };
    }

    const textClient = getOpenAIClient(textKey);
    try {
      const recent = (await strapi.documents("api::post.post").findMany({
        filters: { coverPrompt: { $notNull: true } },
        sort: { createdAt: "desc" },
        fields: ["coverPrompt"],
        limit: 10,
      })) as unknown as Array<{ coverPrompt: string | null }>;
      const recentDescriptions = recent.map((r) => r.coverPrompt!).filter(Boolean);

      const custom = customPrompt?.trim();
      let imagePrompt = "";
      let imageBuffer: Buffer | undefined;
      // A custom prompt is used as-is (no re-seeding); an auto prompt can retry
      // with a fresh seed when Gemini returns an empty 200 ("no inline image data").
      const MAX_TRIES = custom ? 1 : 3;
      for (let tryN = 1; tryN <= MAX_TRIES; tryN++) {
        imagePrompt = custom
          ? custom
          : await chooseImagePrompt(textClient, textModel, {
              title,
              excerpt: excerpt ?? "",
              seedKey: `news-${Date.now()}|${title}|${tryN}`,
              recentDescriptions,
              systemInstructions: imgAgent.imagePromptTemplate?.trim() || settings.imageSystemInstructions,
              themeGuide: settings.imageThemeGuide,
              anchorTaxonomy: settings.imageAnchorTaxonomy,
            });
        try {
          imageBuffer = await generateCoverImage({ openaiImageKey: imageKey, openrouterKey }, imageModel, imagePrompt, {
            size: imgAgent.imageSize ?? undefined,
            quality: imgAgent.imageQuality ?? undefined,
          });
          break;
        } catch (err) {
          const empty = ((err as Error).message ?? "").includes("no inline image data");
          if (!empty || tryN === MAX_TRIES) throw err;
          strapi.log.warn(`[post] newsImage empty image; retrying prompt (${tryN}/${MAX_TRIES})`);
        }
      }
      if (!imageBuffer) throw new Error("Image generation failed after retries.");

      const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
      const mediaId = await uploadImageToStrapi(strapi, imageBuffer, `news-cover-${Date.now()}.${ext}`, title);
      const file = (await strapi.db
        .query("plugin::upload.file")
        .findOne({ where: { id: mediaId }, select: ["url"] })) as { url?: string } | null;
      ctx.body = { mediaId, url: file?.url ?? null, prompt: imagePrompt };
    } catch (err) {
      strapi.log.error("[post] newsImage failed:", err);
      return ctx.internalServerError("Failed to generate cover image.");
    }
  },

  // POST /news-generator/save { title, excerpt, content, coverImageId?, coverPrompt?, tags?, authorName?, publish? }
  //   -> { documentId, slug, published }
  async newsSave(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { title, excerpt, content, coverImageId, coverPrompt, tags, authorName, publish } =
      ctx.request.body as {
        title?: string;
        excerpt?: string;
        content?: string;
        coverImageId?: number;
        coverPrompt?: string;
        tags?: number[];
        authorName?: string;
        publish?: boolean;
      };
    if (!title?.trim() || !content?.trim()) return ctx.badRequest("title and content are required");

    try {
      const created = (await strapi.documents("api::post.post").create({
        data: {
          title,
          slug: makeSlug(title),
          excerpt: excerpt ?? "",
          content,
          ...(coverImageId ? { coverImage: coverImageId } : {}),
          ...(coverPrompt ? { coverPrompt } : {}),
          ...(Array.isArray(tags) && tags.length ? { tags } : {}),
          // Admin-authored: no generatedByAgent → the Director's draft pool
          // (filters generatedByAgent != null) will never re-touch it.
          authorName: authorName?.trim() || (ctx.state.user?.firstname as string) || "Redacción Cogollos del Oeste",
        } as never,
        status: "draft",
      })) as unknown as { documentId: string; slug: string };

      let published = false;
      if (publish) {
        try {
          await strapi.documents("api::post.post").publish({ documentId: created.documentId });
          published = true;
          // EN translation in background — never blocks the response (same as the Director).
          ensurePostTranslation(strapi, created.documentId, { trigger: "manual-news" }).catch((err) =>
            strapi.log.warn(`[post] news translation failed for ${created.documentId}:`, err),
          );
        } catch (err) {
          strapi.log.error(`[post] news publish failed for ${created.documentId}:`, err);
        }
      }
      ctx.body = { documentId: created.documentId, slug: created.slug, published };
    } catch (err) {
      strapi.log.error("[post] newsSave failed:", err);
      return ctx.internalServerError("Failed to save post.");
    }
  },
}));
