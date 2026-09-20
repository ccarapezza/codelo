// Social Studio job runner: executes one generation request (portada /
// carrusel / historia / reel) updating the in-memory job as it goes.
// Restart-safety rule: every EXPENSIVE artifact (AI bg image, AI video clip,
// portada) is uploaded to the Media Library (folder "AI Backgrounds") as soon
// as it exists — a lost job only loses free recompose work (satori/ffmpeg).
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  chooseImagePrompt,
  generateCoverImage,
  getOpenAIClient,
  isOpenRouterModel,
  uploadImageToStrapi,
} from "../openai";
import {
  getOpenAIImageKey,
  getOpenAIImageModel,
  getOpenAITextKey,
  getOpenAITextModel,
  getOpenRouterImageKey,
} from "../openai-config";
import { getPromptSettings } from "../prompt-settings";
import { generateOpenRouterImage } from "../openrouter-image";
import { logAgentAction } from "../audit";
import {
  composeCarousel,
  dataUriFromBuffer,
  dataUriFromFile,
  renderSlide,
  renderToPng,
  SIZES,
  type Slide,
} from "../social-cards";
import { sanitizeSlide } from "../social-cards/composer";
import { composeSingleSlide } from "./compose-single";
import { ensureAiBackgroundsFolder } from "./folders";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  isPostSource,
  pickVideoResolution,
  type GenerateRequest,
  type StudioFormat,
} from "./cost-registry";
import {
  completeJob,
  failJob,
  updateStep,
  type StudioJob,
} from "./jobs";
import { generateClip } from "../social-video/openrouter-video";
import { renderOverlayNode, type OverlayType } from "../social-video/overlays";
import { composeReel } from "../social-video/compose";

// Estilo del prompt de video (b-roll vertical sin texto, en clave de marca).
export const VIDEO_BG_STYLE =
  "Estilo: video editorial botanico y documental, atmosfera cinematografica, luz natural suave, " +
  "tonos verdes profundos y tierra con destellos calidos, camara lenta sutil y movimiento leve y continuo. " +
  "Formato vertical 9:16. Dejar el centro y la mitad inferior mas oscuros y despejados para sobreimprimir texto. " +
  "MUY IMPORTANTE: sin ningun texto, sin letras, sin numeros, sin logos, sin marcas de agua.";

export const DEFAULT_VIDEO_PROMPT =
  "Macro de hojas verdes moviendose apenas con la brisa a contraluz, gotas de rocio, " +
  "profundidad de campo corta, luz dorada de la manana, sin personas ni rostros";

export function stepsForFormat(format: StudioFormat, output?: "image" | "video"): Array<{ key: string; label: string }> {
  switch (format) {
    case "portada":
      return [
        { key: "prompt", label: "Prompt de imagen" },
        { key: "imagen", label: "Generación de la imagen IA" },
        { key: "subir", label: "Subida a Medios (AI Backgrounds)" },
      ];
    case "carrusel":
      return [
        { key: "composicion", label: "Composición del deck (LLM)" },
        { key: "fondo", label: "Fondo de la portada" },
        { key: "render", label: "Render de las placas" },
      ];
    case "historia":
      if (output === "video") {
        return [
          { key: "composicion", label: "Composición de la placa (LLM)" },
          { key: "clip", label: "Clip de video IA" },
          { key: "overlay", label: "Placa overlay" },
          { key: "ffmpeg", label: "Composición final (ffmpeg)" },
        ];
      }
      return [
        { key: "composicion", label: "Composición de la placa (LLM)" },
        { key: "fondo", label: "Fondo" },
        { key: "render", label: "Render 1080×1920" },
      ];
    case "reel":
      return [
        { key: "textos", label: "Textos del overlay" },
        { key: "clip", label: "Clip de video IA" },
        { key: "overlay", label: "Overlay de marca" },
        { key: "ffmpeg", label: "Composición final (ffmpeg)" },
      ];
  }
}

// ---------------------------------------------------------------------------
// Media file helpers (provider-upload-local: files live under public/uploads)

type UploadFileRow = { id: number; url: string; mime: string; name: string };

export async function getUploadFile(strapi: any, fileId: number): Promise<UploadFileRow> {
  const file = await strapi.db.query("plugin::upload.file").findOne({ where: { id: fileId } });
  if (!file) throw new Error(`Archivo ${fileId} no encontrado en Medios.`);
  return file as UploadFileRow;
}

export function absoluteFilePath(strapi: any, file: UploadFileRow): string {
  const publicDir: string = strapi.dirs?.static?.public ?? path.join(process.cwd(), "public");
  return path.join(publicDir, file.url.replace(/^\//, ""));
}

export async function bgUriFromFile(strapi: any, fileId: number): Promise<string> {
  const file = await getUploadFile(strapi, fileId);
  const abs = absoluteFilePath(strapi, file);
  if (fs.existsSync(abs)) return dataUriFromFile(abs);
  throw new Error(`El archivo de fondo no está en disco (${file.url}).`);
}

// ---------------------------------------------------------------------------
// Rendering

export type SizeKey = "portrait" | "story";

// Renders a deck injecting the AI background (data URI) into EVERY slide — the
// same generated image is reused on all placas (free, cohesive). Each template
// applies its own scrim over the bg so the text stays legible.
export async function renderDeck(
  slides: Slide[],
  sizeKey: SizeKey,
  bgUri: string | null,
  scale = 1,
): Promise<Buffer[]> {
  const size = SIZES[sizeKey];
  const out: Buffer[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide: Slide = { ...slides[i] };
    delete slide.bg;
    delete slide._bgUri;
    if (bgUri) slide._bgUri = bgUri;
    out.push(await renderToPng(renderSlide(slide, size), size, scale));
  }
  return out;
}

const PREVIEW_SCALE = 0.5;

// ---------------------------------------------------------------------------
// Source resolution

interface SourceMaterial {
  title: string;
  excerpt: string;
  content: string;
  postDocumentId: string | null;
  postTitle: string | null;
}

async function resolveSource(strapi: any, source: GenerateRequest["source"]): Promise<SourceMaterial> {
  if (isPostSource(source)) {
    const post = (await strapi.documents("api::post.post").findOne({
      documentId: source.postDocumentId,
      fields: ["title", "excerpt", "content"],
    })) as { title: string; excerpt: string | null; content: string | null } | null;
    if (!post) throw new Error("La nota seleccionada no existe.");
    return {
      title: post.title,
      excerpt: post.excerpt ?? "",
      content: post.content ?? "",
      postDocumentId: source.postDocumentId,
      postTitle: post.title,
    };
  }
  const prompt = source.customPrompt.trim();
  return { title: prompt.slice(0, 80), excerpt: "", content: prompt, postDocumentId: null, postTitle: null };
}

// ---------------------------------------------------------------------------
// Background image (Studio lets the user pick the model; route per provider)

async function generateBgImage(strapi: any, model: string, prompt: string): Promise<Buffer> {
  if (isOpenRouterModel(model)) {
    return generateOpenRouterImage(getOpenRouterImageKey(), model, prompt, {
      aspectRatio: "9:16",
      imageSize: "1K",
    });
  }
  // OpenAI gpt-image-*: closest portrait size.
  return generateCoverImage({ openaiImageKey: getOpenAIImageKey() }, model, prompt, { size: "1024x1536" });
}

// ---------------------------------------------------------------------------
// Reel overlay texts (LLM only when sourcing from a post)

async function generateOverlayFields(
  strapi: any,
  material: SourceMaterial,
  type: OverlayType,
  base: Record<string, string>,
): Promise<Record<string, string>> {
  const needsLlm =
    material.postDocumentId !== null &&
    ((type === "title" && !base.title?.trim()) || (type === "countdown" && !base.label?.trim()));
  if (!needsLlm) return base;

  const client = getOpenAIClient(getOpenAITextKey());
  const textModel = await getOpenAITextModel(strapi);
  const ask =
    type === "title"
      ? 'Devolvé JSON { "kicker": "<etiqueta corta, <=22 chars, MAYÚSCULAS implícitas>", "title": "<gancho de la nota, <=55 chars>" }'
      : 'Devolvé JSON { "label": "<contexto corto del countdown, <=55 chars>" }';
  const completion = await client.chat.completions.create({
    model: textModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Sos el editor de redes de Cogollos del Oeste. Tono rioplatense claro, sin emojis. " +
          "Usá SOLO información del material; no inventes datos. " + ask,
      },
      { role: "user", content: `Título: ${material.title}\nResumen: ${material.excerpt}\n\n${material.content.slice(0, 3000)}` },
    ],
  });
  try {
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content ?? "{}") as Record<string, string>;
    return { ...base, ...Object.fromEntries(Object.entries(parsed).filter(([, v]) => typeof v === "string" && v.trim())) };
  } catch {
    return base;
  }
}

// ---------------------------------------------------------------------------
// Clip de video (reel + historia-video): genera o reusa, lo deja en
// tmpDir/clip.mp4, y sube el clip CRUDO a "AI Backgrounds" apenas existe
// (restart-safe + reutilizable). Asume que el step "clip" existe.
async function resolveClip(
  strapi: any,
  job: StudioJob,
  req: GenerateRequest,
  folderId: number,
  tmpDir: string,
): Promise<{ clipFileId: number; clipPath: string; seconds: number; vmKey: string }> {
  const vmKey = req.options.videoModel || DEFAULT_VIDEO_MODEL;
  const vm = VIDEO_MODELS[vmKey];
  if (!vm) throw new Error(`Modelo de video desconocido: ${vmKey}`);
  const seconds = Math.max(3, Math.min(req.options.videoSeconds ?? 8, vm.maxSeconds));
  const clipPath = path.join(tmpDir, "clip.mp4");

  updateStep(job, "clip", { status: "running" });
  let clipFileId: number;
  if (req.options.clipFileId) {
    clipFileId = req.options.clipFileId;
    const file = await getUploadFile(strapi, clipFileId);
    const abs = absoluteFilePath(strapi, file);
    if (!fs.existsSync(abs)) throw new Error(`El clip elegido no está en disco (${file.url}).`);
    fs.copyFileSync(abs, clipPath);
    updateStep(job, "clip", { status: "done", detail: "clip existente (sin IA)" });
  } else {
    const prompt = `${req.options.videoPrompt?.trim() || DEFAULT_VIDEO_PROMPT}. ${VIDEO_BG_STYLE}`;
    await generateClip({
      apiKey: getOpenRouterImageKey(),
      model: vmKey,
      prompt,
      seconds,
      aspect: "9:16",
      resolution: req.options.resolution || pickVideoResolution(vm),
      // Audio OFF: el audio nativo rinde mal y en IG se usa el audio de la
      // plataforma; ffmpeg además compone sin pista de audio (-an).
      generateAudio: false,
      outFile: clipPath,
      onTick: (_status, elapsedMs) => {
        const m = Math.floor(elapsedMs / 60000);
        const s = Math.floor((elapsedMs % 60000) / 1000);
        updateStep(job, "clip", { status: "running", detail: `procesando… ${m}m ${s}s (${vm.label})` });
      },
    });
    clipFileId = await uploadImageToStrapi(
      strapi,
      fs.readFileSync(clipPath),
      `studio-clip-${Date.now()}.mp4`,
      req.options.videoPrompt?.slice(0, 120) || "Clip IA",
      { folderId, mime: "video/mp4" },
    );
    updateStep(job, "clip", { status: "done" });
  }
  return { clipFileId, clipPath, seconds, vmKey };
}

// Historia en formato video: compone (o reusa) UNA placa, la renderiza
// transparente y la superpone sobre el clip con ffmpeg.
async function runStoryVideo(
  strapi: any,
  job: StudioJob,
  req: GenerateRequest,
  material: SourceMaterial,
  folderId: number,
): Promise<void> {
  updateStep(job, "composicion", { status: "running" });
  let slide: Slide;
  if (req.options.slide) {
    const s = sanitizeSlide(req.options.slide);
    if (!s) throw new Error("Slide inválido para recomponer.");
    slide = s;
    updateStep(job, "composicion", { status: "done", detail: "placa editada (sin IA)" });
  } else {
    const client = getOpenAIClient(getOpenAITextKey());
    const textModel = await getOpenAITextModel(strapi);
    const res = await composeSingleSlide(client, textModel, {
      title: material.title,
      excerpt: material.excerpt,
      content: material.content,
      template: req.options.template ?? "cover",
      promptSettings: await getPromptSettings(strapi),
    });
    slide = res.slide;
    updateStep(job, "composicion", { status: "done" });
  }

  job.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-story-"));
  const { clipFileId, clipPath, seconds, vmKey } = await resolveClip(strapi, job, req, folderId, job.tmpDir);

  updateStep(job, "overlay", { status: "running" });
  const overlayPng = path.join(job.tmpDir, "overlay.png");
  const overlaySlide: Slide = { ...slide, _transparent: true };
  fs.writeFileSync(overlayPng, await renderToPng(renderSlide(overlaySlide, SIZES.story), SIZES.story));
  updateStep(job, "overlay", { status: "done" });

  updateStep(job, "ffmpeg", { status: "running" });
  await composeReel({ clip: clipPath, overlay: overlayPng, out: path.join(job.tmpDir, "reel.mp4"), seconds });
  updateStep(job, "ffmpeg", { status: "done" });

  const clipFile = await getUploadFile(strapi, clipFileId);
  completeJob(job, { type: "story-video", slide, clipFileId, clipUrl: clipFile.url, seconds, videoModel: vmKey });
}

// ---------------------------------------------------------------------------
// Job runner

export async function runGenerateJob(strapi: any, job: StudioJob): Promise<void> {
  const req = job.request;
  try {
    const material = await resolveSource(strapi, req.source);
    const folderId = await ensureAiBackgroundsFolder(strapi);

    switch (req.format) {
      case "portada": {
        const imageModel = req.options.imageModel || (await getOpenAIImageModel(strapi));
        updateStep(job, "prompt", { status: "running" });
        let imagePrompt: string;
        if (material.postDocumentId) {
          const promptSettings = await getPromptSettings(strapi);
          const recent = (await strapi.documents("api::post.post").findMany({
            filters: { coverPrompt: { $notNull: true }, documentId: { $ne: material.postDocumentId } },
            sort: { updatedAt: "desc" },
            fields: ["coverPrompt"],
            limit: 10,
          })) as unknown as Array<{ coverPrompt: string | null }>;
          imagePrompt = await chooseImagePrompt(getOpenAIClient(getOpenAITextKey()), await getOpenAITextModel(strapi), {
            title: material.title,
            excerpt: material.excerpt,
            seedKey: `studio|${material.postDocumentId}|${Date.now()}`,
            recentDescriptions: recent.map((r) => r.coverPrompt!).filter(Boolean),
            systemInstructions: promptSettings.imageSystemInstructions,
            themeGuide: promptSettings.imageThemeGuide,
            anchorTaxonomy: promptSettings.imageAnchorTaxonomy,
          });
        } else {
          imagePrompt = material.content;
        }
        updateStep(job, "prompt", { status: "done", detail: imagePrompt.slice(0, 120) });

        updateStep(job, "imagen", { status: "running", detail: imageModel });
        const buffer = await generateCoverImage(
          {
            openaiImageKey: isOpenRouterModel(imageModel) ? undefined : getOpenAIImageKey(),
            openrouterKey: isOpenRouterModel(imageModel) ? getOpenRouterImageKey() : undefined,
          },
          imageModel,
          imagePrompt,
        );
        updateStep(job, "imagen", { status: "done" });

        updateStep(job, "subir", { status: "running" });
        const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
        const fileId = await uploadImageToStrapi(
          strapi,
          buffer,
          `studio-portada-${Date.now()}.${ext}`,
          material.title,
          { folderId },
        );
        const file = await getUploadFile(strapi, fileId);
        updateStep(job, "subir", { status: "done" });

        completeJob(job, { type: "portada", fileId, url: file.url, imagePrompt });
        break;
      }

      case "carrusel":
      case "historia": {
        if (req.format === "historia" && req.options.output === "video") {
          await runStoryVideo(strapi, job, req, material, folderId);
          break;
        }
        const isCarousel = req.format === "carrusel";
        const sizeKey: SizeKey = isCarousel ? "portrait" : "story";
        const imageModel = req.options.imageModel || (await getOpenAIImageModel(strapi));
        const promptSettings = await getPromptSettings(strapi);
        const client = getOpenAIClient(getOpenAITextKey());
        const textModel = await getOpenAITextModel(strapi);

        updateStep(job, "composicion", { status: "running" });
        let slides: Slide[];
        let caption: string | null;
        let coverPrompt: string | null;
        if (isCarousel) {
          const res = await composeCarousel(client, textModel, {
            title: material.title,
            excerpt: material.excerpt,
            content: material.content,
            promptSettings,
          });
          slides = res.slides.slice(0, Math.max(3, Math.min(req.options.slideCount ?? 7, 7)));
          caption = res.caption;
          coverPrompt = res.coverPrompt;
        } else {
          const res = await composeSingleSlide(client, textModel, {
            title: material.title,
            excerpt: material.excerpt,
            content: material.content,
            template: req.options.template ?? "cover",
            promptSettings,
          });
          slides = [res.slide];
          caption = res.caption;
          coverPrompt = res.coverPrompt;
        }
        updateStep(job, "composicion", { status: "done", detail: `${slides.length} placa(s)` });

        updateStep(job, "fondo", { status: "running" });
        let bgFileId: number | null = null;
        let bgUri: string | null = null;
        // La portada SIEMPRE lleva fondo IA. Si el LLM no devolvió un prompt de
        // fondo (`bg.ai`), derivamos uno del título/tema en vez de caer en fondo
        // negro de marca (antes la portada quedaba oscura si el modelo lo omitía).
        const bgPrompt =
          coverPrompt ||
          `${material.postTitle || material.title}. Editorial botanical image, cinematic, ` +
            `deep blue-black tones with amber highlights, no consumption imagery, no text, no logos, no faces.`;
        if (req.options.bgFileId) {
          bgFileId = req.options.bgFileId;
          bgUri = await bgUriFromFile(strapi, bgFileId);
          updateStep(job, "fondo", { status: "done", detail: "fondo existente (sin IA)" });
        } else {
          try {
            const bg = await generateBgImage(strapi, imageModel, bgPrompt);
            bgFileId = await uploadImageToStrapi(strapi, bg, `studio-bg-${Date.now()}.png`, bgPrompt.slice(0, 120), {
              folderId,
              mime: "image/png",
            });
            bgUri = dataUriFromBuffer(bg, "image/png");
            updateStep(job, "fondo", { status: "done", detail: coverPrompt ? undefined : "prompt derivado del título" });
          } catch (err) {
            // Si el fondo IA falla, seguimos con fondo de marca (el deck no se
            // pierde por una imagen).
            strapi.log.warn(`[studio] fondo IA falló: ${(err as Error).message}`);
            updateStep(job, "fondo", { status: "done", detail: "falló la IA — fondo de marca" });
          }
        }

        updateStep(job, "render", { status: "running" });
        const previews = (await renderDeck(slides, sizeKey, bgUri, PREVIEW_SCALE)).map((b) =>
          dataUriFromBuffer(b, "image/png"),
        );
        updateStep(job, "render", { status: "done" });

        completeJob(job, {
          type: "deck",
          slides,
          caption: caption ?? undefined,
          coverPrompt,
          bgFileId,
          size: sizeKey,
          previews,
        });
        break;
      }

      case "reel": {
        const overlayType: OverlayType = req.options.overlay?.type ?? "title";

        updateStep(job, "textos", { status: "running" });
        const fields = await generateOverlayFields(
          strapi,
          material,
          overlayType,
          req.options.overlay?.fields ?? {},
        );
        if (overlayType === "title" && !fields.title?.trim()) fields.title = material.title.slice(0, 55);
        if (overlayType === "countdown" && !fields.big?.trim()) {
          throw new Error('El overlay countdown necesita el campo "big" (el número grande).');
        }
        updateStep(job, "textos", { status: "done" });

        job.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-reel-"));
        const { clipFileId, clipPath, seconds, vmKey } = await resolveClip(strapi, job, req, folderId, job.tmpDir);

        updateStep(job, "overlay", { status: "running" });
        const overlayPng = path.join(job.tmpDir, "overlay.png");
        fs.writeFileSync(overlayPng, await renderToPng(renderOverlayNode(overlayType, fields, SIZES.story), SIZES.story));
        updateStep(job, "overlay", { status: "done" });

        updateStep(job, "ffmpeg", { status: "running" });
        await composeReel({ clip: clipPath, overlay: overlayPng, out: path.join(job.tmpDir, "reel.mp4"), seconds });
        updateStep(job, "ffmpeg", { status: "done" });

        const clipFile = await getUploadFile(strapi, clipFileId);
        completeJob(job, {
          type: "reel",
          clipFileId,
          clipUrl: clipFile.url,
          overlay: { type: overlayType, fields },
          seconds,
          videoModel: vmKey,
        });
        break;
      }
    }

    await logAgentAction(strapi, {
      agentRole: "image-generator",
      action: `studio_${req.format}` as "studio_portada",
      agentName: "Social Studio",
      postDocumentId: material.postDocumentId,
      postTitle: material.postTitle,
      summary: `Social Studio generó ${req.format}${material.postTitle ? ` para: "${material.postTitle}"` : " (prompt propio)"}`,
      metadata: { format: req.format, estimatedCostUsd: job.estimatedCostUsd, trigger: "studio" },
    });
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    strapi.log.error(`[studio] job ${job.id} (${req.format}) falló: ${message}`);
    failJob(job, message);
    await logAgentAction(strapi, {
      agentRole: "image-generator",
      action: "studio_failed",
      agentName: "Social Studio",
      summary: `Social Studio falló generando ${req.format}: ${message.slice(0, 140)}`,
      metadata: { format: req.format, error: message, trigger: "studio" },
    });
  }
}
