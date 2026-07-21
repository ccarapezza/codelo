import * as React from "react";
import {
  Box,
  Flex,
  Typography,
  Badge,
  Loader,
  Button,
  Field,
  SingleSelect,
  SingleSelectOption,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Pagination,
  PreviousLink,
  NextLink,
  PageLink,
  Dots,
  IconButton,
  Modal,
} from "@strapi/design-system";
import { Eye } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";

const ADMIN_API = "/api/agent-action/admin-list";

type AuditItem = {
  id: number;
  documentId: string;
  agentRole: "director" | "redactor" | "image-generator" | "system";
  agentName: string | null;
  agentDocumentId: string | null;
  action: string;
  summary: string;
  postDocumentId: string | null;
  postTitle: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type PaginationMeta = { page: number; pageSize: number; pageCount: number; total: number };

type ListResponse = {
  items: AuditItem[];
  pagination: PaginationMeta;
};

const ROLE_LABEL: Record<AuditItem["agentRole"], string> = {
  director: "Director",
  redactor: "Redactor",
  "image-generator": "Generador IMG",
  system: "Sistema",
};

const ROLE_COLOR: Record<AuditItem["agentRole"], string> = {
  director: "primary",
  redactor: "secondary",
  "image-generator": "success",
  system: "neutral",
};

const ACTION_LABEL: Record<string, string> = {
  draft_created: "Draft creado",
  draft_published: "Publicado",
  draft_rejected: "Rechazado",
  cover_generated: "Cover generado",
  cover_failed: "Cover fallido",
  cover_manual: "Cover manual",
  batch_dispatched: "Batch despachado",
  post_translated: "Traducido (EN)",
  translation_failed: "Traducción fallida",
  agent_failed: "Error",
  redactor_idle: "Sin fuentes",
  director_idle: "Sin drafts",
};

const ACTION_COLOR: Record<string, "success" | "danger" | "neutral" | "warning"> = {
  draft_created: "neutral",
  draft_published: "success",
  draft_rejected: "warning",
  cover_generated: "success",
  cover_failed: "danger",
  cover_manual: "neutral",
  batch_dispatched: "neutral",
  post_translated: "success",
  translation_failed: "danger",
  agent_failed: "danger",
  redactor_idle: "neutral",
  director_idle: "neutral",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const days = Math.round(hr / 24);
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Compact page list with dots: 1 ... 4 5 [6] 7 8 ... 20.
// Always shows first, last, current ±1, and dots in between when there's a gap.
function visiblePages(current: number, total: number): (number | "dots")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "dots", total];
  if (current >= total - 3) return [1, "dots", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "dots", current - 1, current, current + 1, "dots", total];
}

function DetailModal({ item, onClose }: { item: AuditItem | null; onClose: () => void }) {
  const open = item !== null;
  const hasMetadata = item?.metadata && Object.keys(item.metadata).length > 0;

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Modal.Content style={{ width: "80vw", maxWidth: "1000px" }}>
        <Modal.Header>
          <Modal.Title>Detalle de acción</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {item ? (
            <Flex direction="column" alignItems="stretch" gap={4}>
              <Flex gap={2} alignItems="center" wrap="wrap">
                <Badge
                  backgroundColor={`${ROLE_COLOR[item.agentRole]}100`}
                  textColor={`${ROLE_COLOR[item.agentRole]}700`}
                >
                  {ROLE_LABEL[item.agentRole]}
                </Badge>
                <Badge
                  backgroundColor={`${ACTION_COLOR[item.action] ?? "neutral"}100`}
                  textColor={`${ACTION_COLOR[item.action] ?? "neutral"}700`}
                >
                  {ACTION_LABEL[item.action] ?? item.action}
                </Badge>
                {item.agentName ? (
                  <Typography variant="pi" textColor="neutral600">
                    · {item.agentName}
                  </Typography>
                ) : null}
                <Typography variant="pi" textColor="neutral500" style={{ marginLeft: "auto" }}>
                  {absoluteTime(item.createdAt)} ({relativeTime(item.createdAt)})
                </Typography>
              </Flex>

              <Box>
                <Typography variant="sigma" textColor="neutral600">
                  Resumen
                </Typography>
                <Box marginTop={1}>
                  <Typography variant="omega" textColor="neutral800">
                    {item.summary}
                  </Typography>
                </Box>
              </Box>

              {item.postTitle || item.postDocumentId ? (
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Post asociado
                  </Typography>
                  <Box marginTop={1}>
                    <Typography variant="omega" textColor="neutral800">
                      {item.postTitle ?? "(sin título)"}
                    </Typography>
                    {item.postDocumentId ? (
                      <Box>
                        <Typography variant="pi" textColor="neutral500" style={{ fontFamily: "monospace" }}>
                          {item.postDocumentId}
                        </Typography>
                      </Box>
                    ) : null}
                  </Box>
                </Box>
              ) : null}

              {hasMetadata ? (
                <Box>
                  <Typography variant="sigma" textColor="neutral600">
                    Metadata
                  </Typography>
                  <Box
                    marginTop={1}
                    padding={3}
                    background="neutral100"
                    borderColor="neutral200"
                    borderWidth="1px"
                    borderStyle="solid"
                    borderRadius="4px"
                    hasRadius
                    style={{ maxHeight: "50vh", overflow: "auto" }}
                  >
                    <Typography
                      variant="pi"
                      textColor="neutral700"
                      style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}
                    >
                      {JSON.stringify(item.metadata, null, 2)}
                    </Typography>
                  </Box>
                </Box>
              ) : null}
            </Flex>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cerrar</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

export default function AuditPage() {
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [items, setItems] = React.useState<AuditItem[]>([]);
  const [pagination, setPagination] = React.useState<PaginationMeta>({
    page: 1,
    pageSize: 25,
    pageCount: 1,
    total: 0,
  });
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [roleFilter, setRoleFilter] = React.useState<string>("all");
  const [actionFilter, setActionFilter] = React.useState<string>("all");
  const [detail, setDetail] = React.useState<AuditItem | null>(null);

  const fetchPage = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      const { data } = await get<ListResponse>(`${ADMIN_API}?${params.toString()}`);
      setItems(data.items);
      setPagination(data.pagination);
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo cargar el audit log." });
    } finally {
      setLoading(false);
    }
  }, [get, page, pageSize, roleFilter, actionFilter, toggleNotification]);

  React.useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  // Reset to page 1 whenever filters or page size change so we don't end up
  // on a now-empty page after narrowing the query.
  React.useEffect(() => {
    setPage(1);
  }, [roleFilter, actionFilter, pageSize]);

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(pagination.pageCount, p));
    setPage(clamped);
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Eye width="1.4rem" height="1.4rem" />}
        title="Audit · Acciones de Agentes IA"
        subtitle="Trazabilidad de cada acción que ejecutan los Directores, Redactores y Generadores de Imágenes. Solo lectura — append-only."
        actions={
          <Button variant="tertiary" onClick={fetchPage}>
            Refrescar
          </Button>
        }
      />

      <Flex gap={3} marginBottom={4} wrap="wrap" alignItems="flex-end">
        <Box minWidth={220}>
          <Field.Root>
            <Field.Label>Rol</Field.Label>
            <SingleSelect
              value={roleFilter}
              onChange={(v: string | number) => setRoleFilter(String(v))}
            >
              <SingleSelectOption value="all">Todos los roles</SingleSelectOption>
              <SingleSelectOption value="director">Director</SingleSelectOption>
              <SingleSelectOption value="redactor">Redactor</SingleSelectOption>
              <SingleSelectOption value="image-generator">Generador IMG</SingleSelectOption>
              <SingleSelectOption value="system">Sistema</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>
        <Box minWidth={220}>
          <Field.Root>
            <Field.Label>Acción</Field.Label>
            <SingleSelect
              value={actionFilter}
              onChange={(v: string | number) => setActionFilter(String(v))}
            >
              <SingleSelectOption value="all">Todas las acciones</SingleSelectOption>
              <SingleSelectOption value="draft_created">Draft creado</SingleSelectOption>
              <SingleSelectOption value="draft_published">Publicado</SingleSelectOption>
              <SingleSelectOption value="draft_rejected">Rechazado</SingleSelectOption>
              <SingleSelectOption value="cover_generated">Cover generado</SingleSelectOption>
              <SingleSelectOption value="cover_failed">Cover fallido</SingleSelectOption>
              <SingleSelectOption value="cover_manual">Cover manual</SingleSelectOption>
              <SingleSelectOption value="agent_failed">Error</SingleSelectOption>
              <SingleSelectOption value="redactor_idle">Sin fuentes</SingleSelectOption>
              <SingleSelectOption value="director_idle">Sin drafts</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        </Box>
      </Flex>

      {loading ? (
        <Flex justifyContent="center" alignItems="center" minHeight="40vh">
          <Loader>Cargando…</Loader>
        </Flex>
      ) : items.length === 0 ? (
        <Box marginTop={6} background="neutral0" hasRadius shadow="filterShadow">
          <EmptyState
            icon={<Eye width="1.5rem" height="1.5rem" />}
            title="Sin acciones registradas"
            description="Sin acciones registradas con estos filtros."
          />
        </Box>
      ) : (
        <>
          <Box background="neutral0" hasRadius shadow="tableShadow">
            <Table colCount={7} rowCount={items.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Fecha</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Rol</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Acción</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Agente</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Resumen</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Post</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Detalle</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <Box>
                        <Typography variant="pi" fontWeight="bold" textColor="neutral800">
                          {absoluteTime(item.createdAt)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="pi" textColor="neutral500">
                          {relativeTime(item.createdAt)}
                        </Typography>
                      </Box>
                    </Td>
                    <Td>
                      <Badge
                        backgroundColor={`${ROLE_COLOR[item.agentRole]}100`}
                        textColor={`${ROLE_COLOR[item.agentRole]}700`}
                      >
                        {ROLE_LABEL[item.agentRole]}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        backgroundColor={`${ACTION_COLOR[item.action] ?? "neutral"}100`}
                        textColor={`${ACTION_COLOR[item.action] ?? "neutral"}700`}
                      >
                        {ACTION_LABEL[item.action] ?? item.action}
                      </Badge>
                    </Td>
                    <Td>
                      <Typography variant="omega" textColor="neutral800">
                        {item.agentName ?? "—"}
                      </Typography>
                    </Td>
                    <Td>
                      <Box style={{ maxWidth: 420 }}>
                        <Typography
                          variant="omega"
                          textColor="neutral700"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                          title={item.summary}
                        >
                          {item.summary}
                        </Typography>
                      </Box>
                    </Td>
                    <Td>
                      {item.postTitle ? (
                        <Typography
                          variant="pi"
                          textColor="neutral700"
                          title={item.postTitle}
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            maxWidth: 280,
                          }}
                        >
                          {item.postTitle}
                        </Typography>
                      ) : (
                        <Typography variant="pi" textColor="neutral400">
                          —
                        </Typography>
                      )}
                    </Td>
                    <Td>
                      <IconButton label="Ver detalle" onClick={() => setDetail(item)}>
                        <Eye />
                      </IconButton>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          {/* Pagination footer */}
          <Flex
            justifyContent="space-between"
            alignItems="center"
            marginTop={4}
            gap={4}
            wrap="wrap"
          >
            <Flex gap={3} alignItems="center" wrap="wrap">
              <Box minWidth={100}>
                <SingleSelect
                  size="S"
                  aria-label="Filas por página"
                  value={String(pageSize)}
                  onChange={(v: string | number) => setPageSize(Number(v))}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SingleSelectOption key={n} value={String(n)}>
                      {n} / página
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Box>
              <Typography variant="pi" textColor="neutral600">
                {pagination.total} entrada{pagination.total === 1 ? "" : "s"} · página{" "}
                {pagination.page} de {pagination.pageCount}
              </Typography>
            </Flex>

            <Pagination activePage={pagination.page} pageCount={pagination.pageCount}>
              <PreviousLink
                tag="button"
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
              >
                Anterior
              </PreviousLink>
              {visiblePages(pagination.page, pagination.pageCount).map((p, i) =>
                p === "dots" ? (
                  <Dots key={`dots-${i}`}>Más páginas</Dots>
                ) : (
                  <PageLink
                    key={p}
                    number={p}
                    tag="button"
                    type="button"
                    onClick={() => goToPage(p)}
                  >
                    Ir a página {p}
                  </PageLink>
                ),
              )}
              <NextLink
                tag="button"
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
              >
                Siguiente
              </NextLink>
            </Pagination>
          </Flex>
        </>
      )}

      <DetailModal item={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  );
}
