// Safety-net cover generation for posts published WITHOUT a coverImage.
//
// The Director (agent-runner) already generates a cover before publishing, but
// only when an enabled image-generator agent exists, and it publishes anyway if
// generation fails. Posts created straight through the REST API (POST /api/posts)
// never pass through the Director at all. This helper closes both gaps: whenever
// a post ends up published with no cover, it generates one with the same
// pipeline the Director uses, attaches it and republishes — preserving the
// original publishedAt so feed ordering doesn't jump.

import type { Core } from "@strapi/strapi";
import {
  generateCoverImage,
  chooseImagePrompt,
  uploadImageToStrapi,
  getOpenAIClient,
  isOpenRouterModel,
} from "../openai";
import {
  getOpenRouterImageKey,
  getOpenAIImageKey,
  getOpenAIImageModel,
  getOpenAITextKey,
  getOpenAITextModel,
} from "../openai-config";
import { getPromptSettings } from "../prompt-settings";
import { logAgentAction } from "../audit";

type ImageGeneratorAgentDoc = {
  documentId: string;
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
};

async function findActiveImageGenerator(strapi: Core.Strapi): Promise<ImageGeneratorAgentDoc | null> {
  const results = await strapi.documents("api::agent.agent").findMany({
    filters: { role: "image-generator", enabled: true },
  });
  return (results[0] as unknown as ImageGeneratorAgentDoc) ?? null;
}

// Guard against re-entrancy: our own update+publish below re-triggers the publish
// middleware. The coverImage check already short-circuits that, but this avoids
// even starting a second generation for an id already in flight in this process.
const inFlight = new Set<string>();

type PostRow = {
  title: string;
  excerpt: string | null;
  coverPrompt: string | null;
  publishedAt: string | null;
  coverImage: { id: number } | null;
};

/**
 * Ensure a published post has a cover image. No-op when one already exists.
 * Returns the outcome so callers can log/telemetry if they want. Designed to be
 * called fire-and-forget from the publish hook (errors are caught here and also
 * propagated for the caller's own logging).
 */
export async function ensurePostCover(
  strapi: Core.Strapi,
  documentId: string,
): Promise<"skipped" | "generated"> {
  if (inFlight.has(documentId)) return "skipped";
  inFlight.add(documentId);
  try {
    const post = (await strapi.documents("api::post.post").findOne({
      documentId,
      status: "published",
      fields: ["title", "excerpt", "coverPrompt", "publishedAt"],
      populate: ["coverImage"],
    } as never)) as unknown as PostRow | null;

    if (!post) return "skipped";
    if (post.coverImage) return "skipped"; // already has a cover — nothing to do
    if (!post.title?.trim()) return "skipped";

    const textKey = getOpenAITextKey();
    const imageKey = getOpenAIImageKey();
    const textModel = await getOpenAITextModel(strapi);
    const imageModel = await getOpenAIImageModel(strapi);
    const promptSettings = await getPromptSettings(strapi);

    let openrouterKey: string | undefined;
    if (isOpenRouterModel(imageModel)) {
      try {
        openrouterKey = getOpenRouterImageKey();
      } catch {
        // surfaced below via generateCoverImage throwing
      }
    }

    // Prefer the configured image-generator agent's settings; fall back to the
    // vertical defaults so a post still gets a cover even with no agent enabled.
    const imgAgent = await findActiveImageGenerator(strapi);

    // Last 10 cover prompts so the new one is forced to differ.
    const recent = (await strapi.documents("api::post.post").findMany({
      filters: { coverPrompt: { $notNull: true } },
      sort: { createdAt: "desc" },
      fields: ["coverPrompt"],
      limit: 10,
    } as never)) as unknown as Array<{ coverPrompt: string | null }>;
    const recentDescriptions = recent.map((r) => r.coverPrompt!).filter(Boolean);

    const chosenPrompt = await chooseImagePrompt(getOpenAIClient(textKey), textModel, {
      title: post.title,
      excerpt: post.excerpt ?? "",
      seedKey: `${documentId}|${post.title}`,
      recentDescriptions,
      systemInstructions: imgAgent?.imagePromptTemplate?.trim() || promptSettings.imageSystemInstructions,
      themeGuide: promptSettings.imageThemeGuide,
      anchorTaxonomy: promptSettings.imageAnchorTaxonomy,
    });

    const imageBuffer = await generateCoverImage(
      { openaiImageKey: imageKey, openrouterKey },
      imageModel,
      chosenPrompt,
      { size: imgAgent?.imageSize ?? undefined, quality: imgAgent?.imageQuality ?? undefined },
    );

    const ext = isOpenRouterModel(imageModel) ? "png" : "jpg";
    const filename = `cover-${documentId}-${Date.now()}.${ext}`;
    const coverImageId = await uploadImageToStrapi(
      strapi as Parameters<typeof uploadImageToStrapi>[0],
      imageBuffer,
      filename,
      post.title,
    );

    await strapi.documents("api::post.post").update({
      documentId,
      data: { coverImage: coverImageId, coverPrompt: chosenPrompt } as never,
    });
    await strapi.documents("api::post.post").publish({ documentId });

    // Republishing bumps published_at to now; restore the original so the feed
    // order (and the note's real publish time) stays put.
    if (post.publishedAt) {
      try {
        await strapi.db
          .connection("posts")
          .where({ document_id: documentId, locale: "es" })
          .whereNotNull("published_at")
          .update({ published_at: new Date(post.publishedAt) });
      } catch (restoreErr) {
        strapi.log.debug(`[post-cover] restore published_at failed (non-fatal):`, restoreErr);
      }
    }

    strapi.log.info(`[post-cover] Generated missing cover for: ${post.title}`);
    await logAgentAction(strapi, {
      agentRole: "image-generator",
      action: "cover_generated",
      agentName: "Image Generator",
      agentDocumentId: imgAgent?.documentId ?? null,
      postDocumentId: documentId,
      postTitle: post.title,
      summary: `Cover generado (safety-net al publicar) para: "${post.title}"`,
      metadata: { model: imageModel, trigger: "publish-hook", hadImageAgent: Boolean(imgAgent) },
    });

    return "generated";
  } finally {
    inFlight.delete(documentId);
  }
}
