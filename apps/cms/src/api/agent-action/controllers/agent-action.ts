import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";

// Generated types for new content-types aren't available until the next
// `strapi build` regenerates `types/generated/contentTypes.d.ts`.
const UID = "api::agent-action.agent-action" as const;

type ListQuery = {
  page?: string;
  pageSize?: string;
  role?: string;
  action?: string;
};

type AgentActionRow = {
  id: number;
  documentId: string;
  agentRole: string;
  agentName: string | null;
  agentDocumentId: string | null;
  action: string;
  summary: string;
  postDocumentId: string | null;
  postTitle: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default factories.createCoreController(UID as never, ({ strapi }) => ({
  // Page-based pagination so the admin UI can render a real <Pagination>
  // with page numbers. Cursor mode was removed when the AuditPage switched
  // from card-list-with-"load more" to a paginated table.
  async adminList(ctx) {
    if (!(await requireAdmin(ctx, strapi))) return;

    const q = (ctx.query ?? {}) as ListQuery;
    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(Math.max(Number(q.pageSize ?? 25), 1), 100);

    const filters: Record<string, unknown> = {};
    if (q.role && q.role !== "all") filters.agentRole = q.role;
    if (q.action && q.action !== "all") filters.action = q.action;

    const [rows, total] = (await Promise.all([
      strapi.db.query(UID).findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      strapi.db.query(UID).count({ where: filters }),
    ])) as [AgentActionRow[], number];

    const pageCount = Math.max(1, Math.ceil(total / pageSize));

    ctx.body = {
      items: rows,
      pagination: { page, pageSize, pageCount, total },
    };
  },
}));
