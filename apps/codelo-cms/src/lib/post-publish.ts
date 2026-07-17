// Republish a post WITHOUT touching the blog chronology. Strapi's publish()
// resets publishedAt to "now", which would reorder the blog (it sorts by
// publishedAt:desc) — so we restore the original date with a direct query.
// Used by cover/carousel regeneration and Social Studio saves.
// Operates on the Spanish (default) locale only — covers/carousels are managed
// on the es version; the en localization keeps its own publishedAt.
export async function republishPreservingDate(strapi: any, documentId: string): Promise<void> {
  const publishedSibling = (await strapi.documents("api::post.post").findOne({
    documentId,
    locale: "es",
    status: "published",
    fields: ["documentId", "publishedAt"],
  })) as { publishedAt: string | null } | null;
  if (!publishedSibling) return; // draft-only: nothing to republish

  const originalPublishedAt = publishedSibling.publishedAt ?? null;
  await strapi.documents("api::post.post").publish({ documentId, locale: "es" });
  if (originalPublishedAt) {
    await strapi.db.query("api::post.post").updateMany({
      where: { documentId, locale: "es", publishedAt: { $notNull: true } },
      data: { publishedAt: originalPublishedAt },
    });
  }
}
