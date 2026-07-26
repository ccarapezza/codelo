// Vista simple para verificar y publicar/despublicar notas, sin el ruido del
// Content Manager (que queda para editarlas). Sólo lectura + toggle de estado.
//
// Auth: requireAdmin (admin/editor/author) — misma política que el dashboard.
import { requireAdmin } from "../../../lib/admin-auth";

const UID = "api::post.post";
const LOCALE = "es"; // el sitio es ES-only; en es una traducción secundaria
const PAGE_SIZE = 5;

// Estructura mínima que consume la página. Aplana relaciones para no mandar el
// árbol crudo de Strapi.
type Row = {
  documentId: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  tags: string[];
  author: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  featured: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function coverUrlOf(cover: any): string | null {
  if (!cover) return null;
  // Preferimos el thumbnail (liviano) si existe; si no, la original.
  return cover.formats?.thumbnail?.url ?? cover.formats?.small?.url ?? cover.url ?? null;
}

function authorOf(post: any): string | null {
  // authorName lo setea el agente al generar; para notas manuales puede venir
  // vacío. generatedByAgent es el respaldo. (createdBy no se popula: el populate
  // de la relación a admin::user por el document service rechaza sus campos.)
  if (post.authorName) return post.authorName;
  if (post.generatedByAgent?.name) return post.generatedByAgent.name;
  return null;
}

function toRow(post: any): Row {
  return {
    documentId: post.documentId,
    title: post.title ?? "(sin título)",
    excerpt: post.excerpt ?? null,
    coverUrl: coverUrlOf(post.coverImage),
    tags: Array.isArray(post.tags) ? post.tags.map((t: any) => t?.name).filter(Boolean) : [],
    author: authorOf(post),
    publishedAt: post.publishedAt ?? null,
    createdAt: post.createdAt ?? null,
    featured: Boolean(post.featured),
  };
}

const POPULATE = {
  coverImage: { fields: ["url", "formats"] },
  tags: { fields: ["name"] },
  generatedByAgent: { fields: ["name"] },
} as const;

const clampPage = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
};

export default ({ strapi }: { strapi: any }) => ({
  async list(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;

    const publishedPage = clampPage(ctx.query.publishedPage);
    const draftPage = clampPage(ctx.query.draftPage);

    // documentIds ya publicados: sirven para excluirlos de la tabla de
    // borradores (status:'draft' devuelve el borrador de TODOS los documentos,
    // publicados incluidos — sin esto, una nota publicada saldría en las dos).
    const publishedDocs = await strapi.documents(UID).findMany({
      status: "published",
      locale: LOCALE,
      fields: ["documentId"],
      limit: 100000,
    });
    const publishedIds: string[] = publishedDocs.map((p: any) => p.documentId);
    const draftFilter = publishedIds.length ? { documentId: { $notIn: publishedIds } } : {};

    const [publishedItems, publishedTotal, draftItems, draftTotal] = await Promise.all([
      // Publicadas: por fecha de publicación, más nuevas primero.
      strapi.documents(UID).findMany({
        status: "published",
        locale: LOCALE,
        sort: "publishedAt:desc",
        start: (publishedPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        populate: POPULATE,
      }),
      strapi.documents(UID).count({ status: "published", locale: LOCALE }),
      // Sin publicar: borradores que nunca se publicaron, más nuevos primero.
      strapi.documents(UID).findMany({
        status: "draft",
        locale: LOCALE,
        filters: draftFilter,
        sort: "createdAt:desc",
        start: (draftPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        populate: POPULATE,
      }),
      strapi.documents(UID).count({ status: "draft", locale: LOCALE, filters: draftFilter }),
    ]);

    const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));

    ctx.body = {
      pageSize: PAGE_SIZE,
      published: {
        items: publishedItems.map(toRow),
        page: publishedPage,
        pageCount: pageCount(publishedTotal),
        total: publishedTotal,
      },
      unpublished: {
        items: draftItems.map(toRow),
        page: draftPage,
        pageCount: pageCount(draftTotal),
        total: draftTotal,
      },
    };
  },

  // Publica la nota (locale ES, igual que el Director). Dispara los mismos
  // safety-nets de siempre por el middleware de documents (portada/traducción
  // si faltan); para notas que ya las tienen es no-op.
  async publish(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.request.body as { documentId?: string };
    if (!documentId) return ctx.badRequest("documentId es obligatorio");
    await strapi.documents(UID).publish({ documentId, locale: LOCALE });
    ctx.body = { ok: true };
  },

  async unpublish(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId } = ctx.request.body as { documentId?: string };
    if (!documentId) return ctx.badRequest("documentId es obligatorio");
    await strapi.documents(UID).unpublish({ documentId, locale: LOCALE });
    ctx.body = { ok: true };
  },

  // Marca/desmarca la nota como destacada (va al carrusel de la home).
  // Se escribe con updateMany a nivel entidad (no document service) para tocar
  // TODAS las filas del documento —borrador Y publicado, todos los locales— de
  // una: la web lee la versión PUBLICADA, así que el flag tiene que estar ahí
  // sin necesidad de re-publicar. `featured` no es localizado, es un solo valor.
  async setFeatured(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    const { documentId, featured } = ctx.request.body as {
      documentId?: string;
      featured?: boolean;
    };
    if (!documentId) return ctx.badRequest("documentId es obligatorio");
    if (typeof featured !== "boolean") return ctx.badRequest("featured (boolean) es obligatorio");
    await strapi.db
      .query(UID)
      .updateMany({ where: { documentId }, data: { featured } });
    ctx.body = { ok: true };
  },
});
