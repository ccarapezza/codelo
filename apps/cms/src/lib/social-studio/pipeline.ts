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
import type { PromptSettings } from "../prompt-defaults";
import * as project from "../project";
import { generateOpenRouterImage } from "../openrouter-image";
import { logAgentAction } from "../audit";
import {
  bgUriForRender,
  composeCarousel,
  dataUriFromBuffer,
  getRenderContext,
  renderSlide,
  renderToPng,
  SIZES,
  type RenderContext,
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

/**
 * El prompt del clip: lo que pidió el editor más el estilo de la casa.
 *
 * Las dos partes salían de constantes de este archivo y describían un tema
 * concreto —"video editorial botanico", "macro de hojas verdes con rocio"— así
 * que cualquier instancia del motor producía b-roll de ese tema. Ahora son
 * ajustes y se editan desde el panel.
 */
export function buildClipPrompt(ps: PromptSettings, videoPrompt?: string): string {
  return `${videoPrompt?.trim() || ps.videoDefaultPrompt}. ${ps.videoStyle}`;
}

/** La imagen de fondo de la portada cuando el modelo no devolvió un prompt. */
export function buildCoverFallbackPrompt(ps: PromptSettings, title: string): string {
  return `${title}. ${ps.coverFallbackPrompt}`;
}

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
        { key: "textos", label: "Textos del overlay y descripción del clip" },
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

/**
 * El fondo elegido de Medios, listo para la placa. `null` si el archivo está
 * pero el render no lo puede dibujar: la placa sale con el fondo de marca.
 *
 * Se lee por sus bytes y no por la extensión con la que quedó guardado: hay
 * fondos viejos que son JPEG con nombre y mime de PNG.
 */
export async function bgUriFromFile(strapi: any, fileId: number): Promise<string | null> {
  const file = await getUploadFile(strapi, fileId);
  const abs = absoluteFilePath(strapi, file);
  if (!fs.existsSync(abs)) throw new Error(`El archivo de fondo no está en disco (${file.url}).`);
  const uri = bgUriForRender(fs.readFileSync(abs));
  if (!uri) strapi.log.warn(`[studio] el render no puede dibujar el fondo ${file.url}: va el fondo de marca`);
  return uri;
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
  /** La marca, el logo y el @handle de la instalación. Vacío = los del motor. */
  ctx: RenderContext = {},
): Promise<Buffer[]> {
  const size = SIZES[sizeKey];
  const out: Buffer[] = [];
  for (let i = 0; i < slides.length; i++) {
    const slide: Slide = { ...slides[i] };
    delete slide.bg;
    delete slide._bgUri;
    if (bgUri) slide._bgUri = bgUri;
    out.push(await renderToPng(renderSlide(slide, size, ctx), size, scale));
  }
  return out;
}

const PREVIEW_SCALE = 0.5;

// ---------------------------------------------------------------------------
// Source resolution

export interface SourceMaterial {
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
// Reel: textos del overlay y descripción del clip

/**
 * Exportado para poder compararlo sin red (test/preservation).
 *
 * Usaba `project.name` (la env de la instalación) donde el resto de las piezas
 * de redes usa `brandName`, así que el mismo sitio se firmaba de dos formas
 * distintas según la pantalla.
 */
export function buildOverlaySystemPrompt(ps: PromptSettings, ask: string): string {
  return [
    `You are the social-media editor for ${ps.brandName}.`,
    ps.socialVoice,
    `Write in ${ps.writingLanguage}. No emojis. Use ONLY information from the material; invent nothing.`,
    ask,
  ].join("\n");
}

/**
 * Lo que se le pide al modelo en el paso de textos, según qué falte.
 *
 * Es estructura, no línea editorial: qué claves devolver y de qué largo. Con
 * `{ textos: true, clip: false }` es, byte por byte, el pedido de antes.
 *
 * El `clip` es la descripción del b-roll, derivada de la fuente. Va en inglés
 * porque se le pega `videoStyle`, que está en inglés, y así llega al modelo de
 * video; el resto del pedido sigue saliendo en el idioma del sitio.
 */
export function buildOverlayAsk(type: OverlayType, pide: { textos: boolean; clip: boolean }): string {
  const claves: string[] = [];
  if (pide.textos) {
    if (type === "title") {
      claves.push('"kicker": "<short label, <=22 chars>"', '"title": "<hook from the article, <=55 chars>"');
    } else {
      claves.push('"label": "<short countdown context, <=55 chars>"');
    }
  }
  if (pide.clip) {
    claves.push(
      '"clip": "<one sentence IN ENGLISH describing a short b-roll video scene that illustrates the topic ' +
        'of the material: one concrete scene, no text, no logos, no recognisable faces>"',
    );
  }
  return `Return JSON { ${claves.join(", ")} }`;
}

/**
 * Los textos del overlay y, si hace falta, la descripción del clip, en UNA
 * llamada.
 *
 * Los textos se le piden al modelo sólo con una nota de fuente y el campo
 * principal vacío, como siempre. El clip se pide cuando el editor no escribió
 * un prompt ni eligió un clip, venga de una nota o de un prompt propio: antes
 * el video salía siempre del prompt genérico y no tenía nada que ver con la
 * fuente.
 *
 * Lo que el editor escribió no se pisa: el modelo sólo rellena lo vacío.
 */
export async function generateOverlayFields(
  strapi: any,
  material: SourceMaterial,
  type: OverlayType,
  base: Record<string, string>,
  wantClip: boolean,
): Promise<{ fields: Record<string, string>; clip: string | null }> {
  const needsText =
    material.postDocumentId !== null &&
    ((type === "title" && !base.title?.trim()) || (type === "countdown" && !base.label?.trim()));
  if (!needsText && !wantClip) return { fields: base, clip: null };

  const client = getOpenAIClient(getOpenAITextKey());
  const textModel = await getOpenAITextModel(strapi);
  const ps = await getPromptSettings(strapi);
  const completion = await client.chat.completions.create({
    model: textModel,
    temperature: 0.7,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: buildOverlaySystemPrompt(ps, buildOverlayAsk(type, { textos: needsText, clip: wantClip })),
      },
      { role: "user", content: `Título: ${material.title}\nResumen: ${material.excerpt}\n\n${material.content.slice(0, 3000)}` },
    ],
  });
  try {
    const parsed = JSON.parse(completion.choices?.[0]?.message?.content ?? "{}") as Record<string, unknown>;
    const fields = { ...base };
    if (needsText) {
      for (const [k, v] of Object.entries(parsed)) {
        if (k === "clip" || typeof v !== "string" || !v.trim()) continue;
        if (!fields[k]?.trim()) fields[k] = v;
      }
    }
    const clip = wantClip && typeof parsed.clip === "string" && parsed.clip.trim() ? parsed.clip.trim() : null;
    return { fields, clip };
  } catch {
    return { fields: base, clip: null };
  }
}

// ---------------------------------------------------------------------------
// Clip de video (reel + historia-video): genera o reusa, lo deja en
// tmpDir/clip.mp4, y sube el clip CRUDO a "AI Backgrounds" apenas existe
// (restart-safe + reutilizable). Asume que el step "clip" existe.
//
// Qué describe el clip, en orden: lo que escribió el editor; si no escribió
// nada, `derived` (la descripción sacada de la fuente); y sólo si tampoco hay,
// el clip por defecto de los ajustes.
async function resolveClip(
  strapi: any,
  job: StudioJob,
  req: GenerateRequest,
  folderId: number,
  tmpDir: string,
  derived?: string | null,
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
    const escrito = req.options.videoPrompt?.trim();
    const descripcion = escrito || derived?.trim() || undefined;
    const prompt = buildClipPrompt(await getPromptSettings(strapi), descripcion);
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
      descripcion?.slice(0, 120) || "Clip IA",
      { folderId, mime: "video/mp4" },
    );
    // Queda a la vista qué se pidió: es lo único que explica un clip que no
    // se parece a la nota.
    updateStep(job, "clip", {
      status: "done",
      detail: !descripcion
        ? "clip por defecto"
        : escrito
          ? descripcion.slice(0, 120)
          : `desde la fuente: ${descripcion.slice(0, 100)}`,
    });
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
  // La descripción del fondo que el modelo ya escribe al componer la placa:
  // sale de la fuente, así que sirve de descripción del clip. Antes se tiraba.
  let fondoDerivado: string | null = null;
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
    fondoDerivado = res.coverPrompt;
    updateStep(job, "composicion", { status: "done" });
  }

  job.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-story-"));
  const { clipFileId, clipPath, seconds, vmKey } = await resolveClip(
    strapi,
    job,
    req,
    folderId,
    job.tmpDir,
    fondoDerivado,
  );

  updateStep(job, "overlay", { status: "running" });
  const overlayPng = path.join(job.tmpDir, "overlay.png");
  const overlaySlide: Slide = { ...slide, _transparent: true };
  fs.writeFileSync(
    overlayPng,
    await renderToPng(renderSlide(overlaySlide, SIZES.story, await getRenderContext(strapi)), SIZES.story),
  );
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
        brandPalette: promptSettings.brandPalette,
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
        // Sin extensión: la pone la subida, mirando los bytes.
        const fileId = await uploadImageToStrapi(
          strapi,
          buffer,
          `studio-portada-${Date.now()}`,
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
          buildCoverFallbackPrompt(
            await getPromptSettings(strapi),
            material.postTitle || material.title,
          );
        if (req.options.bgFileId) {
          bgFileId = req.options.bgFileId;
          bgUri = await bgUriFromFile(strapi, bgFileId);
          updateStep(job, "fondo", {
            status: "done",
            detail: bgUri ? "fondo existente (sin IA)" : "el render no puede dibujar ese archivo — fondo de marca",
          });
        } else {
          try {
            const bg = await generateBgImage(strapi, imageModel, bgPrompt);
            // La imagen ya está paga: se sube antes de saber si el render la
            // puede dibujar. Sin extensión ni mime: los pone la subida, por bytes.
            bgFileId = await uploadImageToStrapi(strapi, bg, `studio-bg-${Date.now()}`, bgPrompt.slice(0, 120), {
              folderId,
            });
            bgUri = bgUriForRender(bg);
            if (!bgUri) {
              strapi.log.warn(`[studio] ${imageModel} devolvió un formato que el render no dibuja: va el fondo de marca`);
              updateStep(job, "fondo", { status: "done", detail: "formato de imagen no soportado — fondo de marca" });
            } else {
              updateStep(job, "fondo", { status: "done", detail: coverPrompt ? undefined : "prompt derivado del título" });
            }
          } catch (err) {
            // Si el fondo IA falla, seguimos con fondo de marca (el deck no se
            // pierde por una imagen).
            strapi.log.warn(`[studio] fondo IA falló: ${(err as Error).message}`);
            updateStep(job, "fondo", { status: "done", detail: "falló la IA — fondo de marca" });
          }
        }

        updateStep(job, "render", { status: "running" });
        const previews = (await renderDeck(slides, sizeKey, bgUri, PREVIEW_SCALE, await getRenderContext(strapi))).map((b) =>
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
        // Sin prompt escrito y sin clip elegido, la descripción del clip sale
        // de la fuente, en la misma llamada que los textos.
        const wantClip = !req.options.clipFileId && !req.options.videoPrompt?.trim();
        const { fields, clip } = await generateOverlayFields(
          strapi,
          material,
          overlayType,
          req.options.overlay?.fields ?? {},
          wantClip,
        );
        if (overlayType === "title" && !fields.title?.trim()) fields.title = material.title.slice(0, 55);
        if (overlayType === "countdown" && !fields.big?.trim()) {
          throw new Error('El overlay countdown necesita el campo "big" (el número grande).');
        }
        updateStep(job, "textos", { status: "done" });

        job.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-reel-"));
        const { clipFileId, clipPath, seconds, vmKey } = await resolveClip(
          strapi,
          job,
          req,
          folderId,
          job.tmpDir,
          clip,
        );

        updateStep(job, "overlay", { status: "running" });
        const overlayPng = path.join(job.tmpDir, "overlay.png");
        fs.writeFileSync(
          overlayPng,
          await renderToPng(
            renderOverlayNode(overlayType, fields, SIZES.story, await getRenderContext(strapi)),
            SIZES.story,
          ),
        );
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
