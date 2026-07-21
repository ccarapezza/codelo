// Social Studio controller: config/registries, AI-backgrounds listing, async
// generation jobs (poll-based), free satori re-renders for the editable
// preview, and the final save (full-res render server-side → Media / post).
import * as fs from "node:fs";
import * as path from "node:path";
import { requireAdmin } from "../../../lib/admin-auth";
import { uploadImageToStrapi } from "../../../lib/openai";
import { getOpenAIImageModel } from "../../../lib/openai-config";
import { republishPreservingDate } from "../../../lib/post-publish";
import { sanitizeSlide } from "../../../lib/social-cards/composer";
import { dataUriFromBuffer, SIZES, type Slide } from "../../../lib/social-cards";
import {
  DEFAULT_VIDEO_MODEL,
  IMAGE_MODELS,
  LLM_CALL_ESTIMATE_USD,
  VIDEO_MODELS,
  estimateCost,
  isPostSource,
  isVideoRequest,
  type GenerateRequest,
} from "../../../lib/social-studio/cost-registry";
import { listBackgrounds } from "../../../lib/social-studio/folders";
import {
  canCreateJob,
  createJob,
  getJob,
} from "../../../lib/social-studio/jobs";
import {
  DEFAULT_VIDEO_PROMPT,
  bgUriFromFile,
  renderDeck,
  runGenerateJob,
  stepsForFormat,
  type SizeKey,
} from "../../../lib/social-studio/pipeline";
import { probeFfmpeg } from "../../../lib/social-video/ffmpeg";

const FORMATS = ["portada", "carrusel", "historia", "reel"] as const;

function parseSlides(raw: unknown): Slide[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeSlide).filter((s): s is Slide => s !== null);
}

function validateGenerateRequest(body: unknown): { ok: true; req: GenerateRequest } | { ok: false; error: string } {
  const b = body as Partial<GenerateRequest> | null;
  if (!b || typeof b !== "object") return { ok: false, error: "Body inválido." };
  if (!FORMATS.includes(b.format as (typeof FORMATS)[number])) {
    return { ok: false, error: `Formato inválido. Opciones: ${FORMATS.join(", ")}.` };
  }
  const source = b.source as GenerateRequest["source"] | undefined;
  const hasPost = source && typeof (source as { postDocumentId?: unknown }).postDocumentId === "string";
  const hasPrompt =
    source &&
    typeof (source as { customPrompt?: unknown }).customPrompt === "string" &&
    ((source as { customPrompt: string }).customPrompt.trim().length > 0);
  if (!hasPost && !hasPrompt) {
    return { ok: false, error: "Elegí una nota o escribí un prompt propio." };
  }
  const options = (b.options ?? {}) as GenerateRequest["options"];
  if (options.imageModel && !IMAGE_MODELS[options.imageModel]) {
    return { ok: false, error: `Modelo de imagen desconocido: ${options.imageModel}` };
  }
  const candidate = { format: b.format, source: source!, options } as GenerateRequest;
  if (isVideoRequest(candidate)) {
    const vmKey = options.videoModel || DEFAULT_VIDEO_MODEL;
    const vm = VIDEO_MODELS[vmKey];
    if (!vm) return { ok: false, error: `Modelo de video desconocido: ${vmKey}` };
    if (options.videoSeconds && options.videoSeconds > vm.maxSeconds) {
      return { ok: false, error: `${vm.label} genera hasta ${vm.maxSeconds}s.` };
    }
    if (b.format === "reel" && options.overlay && !["title", "countdown"].includes(options.overlay.type)) {
      return { ok: false, error: "Overlay inválido (title | countdown)." };
    }
  }
  return { ok: true, req: candidate };
}

export default ({ strapi }: { strapi: any }) => ({
  // Registries + defaults + capability flags for the Studio page.
  async config(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const [defaultImageModel, ffmpegAvailable] = await Promise.all([
      getOpenAIImageModel(strapi),
      probeFfmpeg(),
    ]);
    ctx.body = {
      imageModels: IMAGE_MODELS,
      videoModels: VIDEO_MODELS,
      llmCallEstimateUsd: LLM_CALL_ESTIMATE_USD,
      defaults: {
        imageModel: IMAGE_MODELS[defaultImageModel] ? defaultImageModel : "google/gemini-2.5-flash-image",
        videoModel: DEFAULT_VIDEO_MODEL,
        videoPrompt: DEFAULT_VIDEO_PROMPT,
      },
      keys: {
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
        openrouter: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
      },
      ffmpegAvailable,
    };
  },

  // Files inside the "AI Backgrounds" folder, filtered by mime type.
  async backgrounds(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const type = ctx.query.type === "video" ? "video" : "image";
    ctx.body = { files: await listBackgrounds(strapi, type) };
  },

  // Fire-and-poll generation. Returns 202 with the job id + the cost plan.
  async generate(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const validation = validateGenerateRequest(ctx.request.body);
    if (validation.ok === false) return ctx.badRequest(validation.error);
    const req = validation.req;

    if (!canCreateJob()) {
      ctx.status = 429;
      ctx.body = { error: "Ya hay 2 generaciones en curso. Esperá a que terminen." };
      return;
    }

    const { lines, totalUsd } = estimateCost(req);
    const job = createJob(req.format, req, totalUsd, stepsForFormat(req.format, req.options.output));

    // Background execution; the page polls /jobs/:id.
    void runGenerateJob(strapi, job);

    ctx.status = 202;
    ctx.body = { jobId: job.id, estimatedCostUsd: totalUsd, lines };
  },

  async jobStatus(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const job = getJob(ctx.params.jobId);
    if (!job) {
      return ctx.notFound(
        "El trabajo expiró (probablemente por un reinicio del servidor). Los fondos generados quedaron en la carpeta AI Backgrounds.",
      );
    }
    const { id, kind, status, steps, result, error, estimatedCostUsd } = job;
    ctx.body = { id, kind, status, steps, result, error, estimatedCostUsd };
  },

  // Streams the composed reel preview from the job's tmp dir.
  // NO requireAdmin: the admin <video> tag can't attach the Bearer header and
  // the fetch client only parses JSON. The random job UUID acts as a
  // capability URL (unguessable, expires with the job, content not sensitive).
  async jobVideo(ctx: any) {
    const job = getJob(ctx.params.jobId);
    const file = job?.tmpDir ? path.join(job.tmpDir, "reel.mp4") : null;
    if (!file || !fs.existsSync(file)) {
      return ctx.notFound("El preview del reel ya no está disponible. Recomponé el reel (es gratis: el clip quedó guardado).");
    }
    const size = fs.statSync(file).size;
    ctx.set("Content-Type", "video/mp4");
    ctx.set("Accept-Ranges", "bytes");
    if (ctx.query.download) {
      ctx.set("Content-Disposition", `attachment; filename="reel-codelo-${ctx.params.jobId.slice(0, 8)}.mp4"`);
    }

    // Range support (206): sin esto el <video> no puede buscar y algunos
    // navegadores bajan TODO antes de reproducir → "no se reproduce / se traba".
    const range = ctx.headers.range as string | undefined;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      const start = m && m[1] ? parseInt(m[1], 10) : 0;
      const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
      if (start >= size || end >= size || start > end) {
        ctx.status = 416;
        ctx.set("Content-Range", `bytes */${size}`);
        return;
      }
      ctx.status = 206;
      ctx.set("Content-Range", `bytes ${start}-${end}/${size}`);
      ctx.set("Content-Length", String(end - start + 1));
      ctx.body = fs.createReadStream(file, { start, end });
      return;
    }

    ctx.set("Content-Length", String(size));
    ctx.body = fs.createReadStream(file);
  },

  // Free re-render for the editable preview: edited slides → half-scale PNGs.
  // No AI here, ever — backgrounds come from Media by id.
  async renderPreview(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const body = ctx.request.body as {
      slides?: unknown;
      size?: SizeKey;
      bgFileId?: number | null;
      scale?: number;
    };
    const slides = parseSlides(body.slides);
    if (slides.length === 0) return ctx.badRequest("No hay placas válidas para renderizar.");
    const sizeKey: SizeKey = body.size === "story" ? "story" : "portrait";
    // scale 0.5 = preview liviano (default); 1 = full-res para descargar.
    const scale = typeof body.scale === "number" ? Math.min(1, Math.max(0.1, body.scale)) : 0.5;
    const bgUri = body.bgFileId ? await bgUriFromFile(strapi, body.bgFileId).catch(() => null) : null;
    const previews = (await renderDeck(slides, sizeKey, bgUri, scale)).map((b) => dataUriFromBuffer(b, "image/png"));
    ctx.body = { previews };
  },

  // Final save: authoritative full-res render server-side (never trusts client
  // pixels) → Media Library, plus post persistence for portada/carrusel.
  async save(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const body = ctx.request.body as {
      format?: string;
      postDocumentId?: string;
      fileId?: number;
      imagePrompt?: string;
      slides?: unknown;
      caption?: string;
      coverPrompt?: string | null;
      bgFileId?: number | null;
      jobId?: string;
    };

    switch (body.format) {
      case "portada": {
        if (!body.postDocumentId || !body.fileId) {
          return ctx.badRequest("Faltan postDocumentId/fileId.");
        }
        await strapi.documents("api::post.post").update({
          documentId: body.postDocumentId,
          data: { coverImage: body.fileId, coverPrompt: body.imagePrompt ?? null },
        });
        await republishPreservingDate(strapi, body.postDocumentId);
        ctx.body = { ok: true };
        return;
      }

      case "carrusel": {
        if (!body.postDocumentId) return ctx.badRequest("El carrusel se guarda sobre una nota (falta postDocumentId).");
        const slides = parseSlides(body.slides);
        if (slides.length < 1) return ctx.badRequest("No hay placas válidas.");
        const post = (await strapi.documents("api::post.post").findOne({
          documentId: body.postDocumentId,
          fields: ["title"],
        })) as { title: string } | null;
        if (!post) return ctx.badRequest("La nota no existe.");

        const bgUri = body.bgFileId ? await bgUriFromFile(strapi, body.bgFileId).catch(() => null) : null;
        const pngs = await renderDeck(slides, "portrait", bgUri, 1);
        const uploadIds: number[] = [];
        const planSlides: Array<{ index: number; uploadId: number; slide: Slide }> = [];
        for (let i = 0; i < pngs.length; i++) {
          const n = String(i + 1).padStart(2, "0");
          const uploadId = await uploadImageToStrapi(
            strapi,
            pngs[i],
            `slide-${n}-${body.postDocumentId}-${Date.now()}.png`,
            `${post.title} — placa ${i + 1}`,
          );
          uploadIds.push(uploadId);
          planSlides.push({ index: i, uploadId, slide: slides[i] });
        }
        const caption = (body.caption ?? "").slice(0, 2200);
        const carouselPlan = {
          size: SIZES.portrait,
          caption,
          generatedAt: new Date().toISOString(),
          slides: planSlides,
          bgFileId: body.bgFileId ?? null,
        };
        await strapi.documents("api::post.post").update({
          documentId: body.postDocumentId,
          data: { socialCards: uploadIds, carouselPlan, socialCaption: caption },
        });
        await republishPreservingDate(strapi, body.postDocumentId);
        ctx.body = { ok: true, uploadIds };
        return;
      }

      case "historia": {
        const slides = parseSlides(body.slides);
        if (slides.length < 1) return ctx.badRequest("No hay placa válida.");
        const bgUri = body.bgFileId ? await bgUriFromFile(strapi, body.bgFileId).catch(() => null) : null;
        const [png] = await renderDeck(slides.slice(0, 1), "story", bgUri, 1);
        const fileId = await uploadImageToStrapi(
          strapi,
          png,
          `studio-historia-${Date.now()}.png`,
          slides[0].title || slides[0].label || "Historia Cogollos del Oeste",
        );
        const file = await strapi.db.query("plugin::upload.file").findOne({ where: { id: fileId } });
        ctx.body = { ok: true, fileId, url: file?.url ?? null };
        return;
      }

      case "reel": {
        if (!body.jobId) return ctx.badRequest("Falta jobId.");
        const job = getJob(body.jobId);
        const file = job?.tmpDir ? path.join(job.tmpDir, "reel.mp4") : null;
        if (!file || !fs.existsSync(file)) {
          ctx.status = 409;
          ctx.body = { error: "El reel temporal ya no existe. Recomponé el reel (es gratis: el clip quedó guardado en AI Backgrounds)." };
          return;
        }
        const fileId = await uploadImageToStrapi(
          strapi,
          fs.readFileSync(file),
          `studio-reel-${Date.now()}.mp4`,
          "Reel Cogollos del Oeste",
          { mime: "video/mp4" },
        );
        const row = await strapi.db.query("plugin::upload.file").findOne({ where: { id: fileId } });
        ctx.body = { ok: true, fileId, url: row?.url ?? null };
        return;
      }

      default:
        return ctx.badRequest("Formato inválido.");
    }
  },
});
