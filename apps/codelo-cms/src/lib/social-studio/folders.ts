// "AI Backgrounds" Media Library folder: every AI-generated background (images
// AND video clips) lands here so the Studio can offer reusing them and skip the
// AI generation cost entirely. One flat folder; the picker filters by mime.
const FOLDER_NAME = "AI Backgrounds";

let cachedFolderId: number | undefined;

export async function ensureAiBackgroundsFolder(strapi: any): Promise<number> {
  if (cachedFolderId !== undefined) {
    // Re-validate the cache (folder could have been deleted from the admin).
    const still = await strapi.db
      .query("plugin::upload.folder")
      .findOne({ where: { id: cachedFolderId } });
    if (still) return cachedFolderId;
    cachedFolderId = undefined;
  }

  const existing = await strapi.db
    .query("plugin::upload.folder")
    .findOne({ where: { name: FOLDER_NAME, parent: null } });
  if (existing) {
    cachedFolderId = existing.id as number;
    return cachedFolderId;
  }

  const created = await strapi.plugin("upload").service("folder").create({ name: FOLDER_NAME });
  cachedFolderId = created.id as number;
  return cachedFolderId;
}

export interface BackgroundFile {
  id: number;
  name: string;
  url: string;
  mime: string;
  width: number | null;
  height: number | null;
  size: number;
  createdAt: string;
}

export async function listBackgrounds(
  strapi: any,
  type: "image" | "video",
): Promise<BackgroundFile[]> {
  const folderId = await ensureAiBackgroundsFolder(strapi);
  const files = await strapi.db.query("plugin::upload.file").findMany({
    where: { folder: { id: folderId }, mime: { $startsWith: `${type}/` } },
    orderBy: { createdAt: "desc" },
    limit: 60,
  });
  return (files as any[]).map((f) => ({
    id: f.id,
    name: f.name,
    url: f.url,
    mime: f.mime,
    width: f.width ?? null,
    height: f.height ?? null,
    size: f.size,
    createdAt: f.createdAt,
  }));
}
