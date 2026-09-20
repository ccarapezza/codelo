// Safety-net + Director-driven English translation for published posts.
//
// Notes are written and published in Spanish (the default locale). Whenever one
// is published — by the Director, the content manager, or straight through the
// REST API — this helper creates/publishes the matching "en" localization with
// the same documentId, so the frontend can serve each locale and cross-link the
// slugs. Mirrors the ensurePostCover pattern: re-entrancy guard, no-op when the
// translation already exists, fire-and-forget friendly (errors are logged to
// the audit trail here and propagated for the caller's own handling).

import type { Core } from "@strapi/strapi";
import { getOpenAIClient, translatePost } from "./openai";
import { getOpenAITextKey, getOpenAITextModel } from "./openai-config";
import { logAgentAction } from "./audit";

const UID = "api::post.post";

// Guard against re-entrancy: our own update+publish on the "en" locale
// re-triggers the publish middleware (which also calls this helper).
const inFlight = new Set<string>();

type SourcePost = {
  title: string;
  excerpt: string | null;
  content: string | null;
  publishedAt: string | null;
  coverImage: { id: number } | null;
  tags: Array<{ id: number }>;
  generatedByAgent: { documentId: string } | null;
};

function normalizeSlug(raw: string, fallbackTitle: string): string {
  const base = (raw || fallbackTitle)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "post";
}

// uid slugs are unique per locale; make sure the proposed English slug doesn't
// collide with another document's "en" version (drafts included).
async function uniqueEnSlug(
  strapi: Core.Strapi,
  base: string,
  documentId: string,
): Promise<string> {
  let slug = base;
  for (let n = 2; n <= 50; n++) {
    const clash = (await strapi.documents(UID).findMany({
      locale: "en",
      filters: { slug: { $eq: slug }, documentId: { $ne: documentId } },
      fields: ["documentId"],
      limit: 1,
    })) as unknown as Array<{ documentId: string }>;
    if (clash.length === 0) return slug;
    slug = `${base}-${n}`;
  }
  // Pathological collision storm — fall back to a time suffix like makeSlug().
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Ensure a published Spanish post has a published English localization.
 * No-op when one already exists (unless `force`), when the post isn't
 * published, or when a translation for this documentId is already in flight.
 */
export async function ensurePostTranslation(
  strapi: Core.Strapi,
  documentId: string,
  opts: { force?: boolean; trigger?: string } = {},
): Promise<"skipped" | "translated"> {
  if (inFlight.has(documentId)) return "skipped";
  inFlight.add(documentId);
  try {
    const post = (await strapi.documents(UID).findOne({
      documentId,
      locale: "es",
      status: "published",
      fields: ["title", "excerpt", "content", "publishedAt"],
      populate: ["coverImage", "tags", "generatedByAgent"],
    } as never)) as unknown as SourcePost | null;

    if (!post) return "skipped"; // not published (or not a Spanish post)
    if (!post.title?.trim()) return "skipped";

    if (!opts.force) {
      const existingEn = (await strapi.documents(UID).findOne({
        documentId,
        locale: "en",
        status: "published",
        fields: ["documentId"],
      } as never)) as unknown as { documentId: string } | null;
      if (existingEn) return "skipped"; // already translated & published
    }

    const client = getOpenAIClient(getOpenAITextKey());
    const model = await getOpenAITextModel(strapi);

    try {
      const translated = await translatePost(client, model, {
        title: post.title,
        excerpt: post.excerpt ?? "",
        content: post.content ?? "",
      });

      const slug = await uniqueEnSlug(
        strapi,
        normalizeSlug(translated.slug, translated.title),
        documentId,
      );

      // update() with a locale that doesn't exist yet creates that localization.
      // Relations and media are copied explicitly so the "en" version always
      // shares the Spanish post's cover, tags and agent, regardless of how the
      // schema's non-localized sync behaves for link-table fields.
      await strapi.documents(UID).update({
        documentId,
        locale: "en",
        data: {
          title: translated.title,
          slug,
          excerpt: translated.excerpt,
          content: translated.content,
          ...(post.coverImage ? { coverImage: post.coverImage.id } : {}),
          ...(post.tags?.length ? { tags: post.tags.map((t) => t.id) } : {}),
          ...(post.generatedByAgent
            ? { generatedByAgent: post.generatedByAgent.documentId }
            : {}),
        } as never,
      });
      await strapi.documents(UID).publish({ documentId, locale: "en" });

      // publish() stamps "now"; mirror the Spanish publishedAt so both locales
      // share the same position in publishedAt-sorted feeds. Re-read it here
      // (instead of using the snapshot from before the LLM call) because the
      // Director staggers the Spanish published_at while the translation runs.
      try {
        const esRow = (await strapi.db
          .connection("posts")
          .where({ document_id: documentId, locale: "es" })
          .whereNotNull("published_at")
          .first("published_at")) as { published_at: Date | string } | undefined;
        if (esRow?.published_at) {
          await strapi.db
            .connection("posts")
            .where({ document_id: documentId, locale: "en" })
            .whereNotNull("published_at")
            .update({ published_at: new Date(esRow.published_at) });
        }
      } catch (restoreErr) {
        strapi.log.debug(`[translate-post] align published_at failed (non-fatal):`, restoreErr);
      }

      strapi.log.info(`[translate-post] English localization published for: ${post.title}`);
      await logAgentAction(strapi, {
        agentRole: "director",
        action: "post_translated",
        agentName: "Translator",
        postDocumentId: documentId,
        postTitle: post.title,
        summary: `Nota traducida al inglés: "${post.title}" → "${translated.title}"`,
        metadata: {
          model,
          slugEn: slug,
          trigger: opts.trigger ?? "publish-hook",
          forced: Boolean(opts.force),
        },
      });

      return "translated";
    } catch (err) {
      await logAgentAction(strapi, {
        agentRole: "director",
        action: "translation_failed",
        agentName: "Translator",
        postDocumentId: documentId,
        postTitle: post.title,
        summary: `Falló la traducción al inglés de: "${post.title}"`,
        metadata: { error: (err as Error).message, trigger: opts.trigger ?? "publish-hook" },
      });
      throw err;
    }
  } finally {
    inFlight.delete(documentId);
  }
}
