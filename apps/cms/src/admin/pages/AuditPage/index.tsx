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
import { Eye, ArrowLeft } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useNavigate } from "react-router-dom";
import * as verticals from "../../verticals";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useLocaleFechas, useT } from "../../i18n";

const ADMIN_API = "/api/agent-action/admin-list";

type AuditItem = {
  id: number;
  documentId: string;
  agentRole: "director" | "redactor" | "explorador" | "image-generator" | "system" | (string & {});
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

// Los roles del motor, más los que aporte el vertical (admin/verticals.ts).
// Un rol sin etiqueta se mostraría con su valor crudo, así que la lista del
// vertical entra también acá y no sólo en el selector. Las etiquetas del motor
// son CLAVES y se traducen al renderizar; las del proyecto vienen como texto
// literal, que `t()` devuelve tal cual.
const CORE_ROLES = [
  { value: "director", label: "ag.director", badgeVariant: "primary" },
  { value: "redactor", label: "ag.redactor", badgeVariant: "secondary" },
  { value: "explorador", label: "ag.explorador", badgeVariant: "alternative" },
  { value: "image-generator", label: "ag.generadorImagenes", badgeVariant: "success" },
  { value: "system", label: "audit.rol.sistema", badgeVariant: "neutral" },
];

// La costura se lee defensiva, como en Ajustes y Configuración editorial: un
// proyecto con un `admin/verticals.ts` anterior a `agentRoles` no la exporta, y
// un spread de `undefined` tira la pantalla entera.
const ALL_ROLES = [...CORE_ROLES, ...((verticals as Partial<typeof verticals>).agentRoles ?? [])];

const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ALL_ROLES.map((r) => [r.value, r.label]),
);

const ROLE_COLOR: Record<string, string> = Object.fromEntries(
  ALL_ROLES.map((r) => [r.value, r.badgeVariant]),
);

// Claves, no texto: se traducen al renderizar. Es además la lista del filtro,
// así que una acción nueva del enum aparece en los dos lugares a la vez.
const ACTION_LABEL: Record<string, string> = {
  draft_created: "audit.acc.draftCreado",
  draft_published: "audit.acc.publicado",
  draft_rejected: "audit.acc.rechazado",
  cover_generated: "audit.acc.coverGenerado",
  cover_failed: "audit.acc.coverFallido",
  cover_manual: "audit.acc.coverManual",
  carousel_manual: "audit.acc.carruselManual",
  carousel_failed: "audit.acc.carruselFallido",
  batch_dispatched: "audit.acc.batch",
  post_translated: "audit.acc.traducido",
  translation_failed: "audit.trad.fallida",
  agent_failed: "audit.acc.error",
  redactor_idle: "audit.sinFuentes",
  director_idle: "audit.sinDrafts",
  director_recheck: "audit.acc.relectura",
  director_trimmed: "audit.acc.recortada",
  explorador_idle: "audit.sinInvestigacion",
  studio_portada: "audit.acc.studioPortada",
  studio_carrusel: "audit.acc.studioCarrusel",
  studio_historia: "audit.acc.studioHistoria",
  studio_reel: "audit.acc.studioReel",
  studio_failed: "audit.acc.studioFallido",
};

const ACTION_COLOR: Record<string, "success" | "danger" | "neutral" | "warning"> = {
  draft_created: "neutral",
  draft_published: "success",
  draft_rejected: "warning",
  cover_generated: "success",
  cover_failed: "danger",
  cover_manual: "neutral",
  carousel_manual: "neutral",
  carousel_failed: "danger",
  batch_dispatched: "neutral",
  post_translated: "success",
  translation_failed: "danger",
  agent_failed: "danger",
  redactor_idle: "neutral",
  director_idle: "neutral",
  director_recheck: "neutral",
  // Publicada, pero con frases quitadas: vale una mirada humana.
  director_trimmed: "warning",
  explorador_idle: "neutral",
  studio_portada: "success",
  studio_carrusel: "success",
  studio_historia: "success",
  studio_reel: "success",
  studio_failed: "danger",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type T = ReturnType<typeof useT>;

function relativeTime(iso: string, t: T, loc: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return t("audit.hace", { cuanto: `${sec}s` });
  const min = Math.round(sec / 60);
  if (min < 60) return t("audit.hace", { cuanto: `${min}m` });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("audit.hace", { cuanto: `${hr}h` });
  const days = Math.round(hr / 24);
  if (days < 7) return t("audit.hace", { cuanto: `${days}d` });
  return d.toLocaleDateString(loc, { day: "2-digit", month: "short" });
}

function absoluteTime(iso: string, loc: string): string {
  return new Date(iso).toLocaleString(loc, {
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
  const t = useT();
  const loc = useLocaleFechas();
  const open = item !== null;
  const hasMetadata = item?.metadata && Object.keys(item.metadata).length > 0;

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Modal.Content style={{ width: "80vw", maxWidth: "1000px" }}>
        <Modal.Header>
          <Modal.Title>{t("audit.detalle")}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {item ? (
            <Flex direction="column" alignItems="stretch" gap={4}>
              <Flex gap={2} alignItems="center" wrap="wrap">
                <Badge
                  backgroundColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}100`}
                  textColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}700`}
                >
                  {t(ROLE_LABEL[item.agentRole] ?? item.agentRole)}
                </Badge>
                <Badge
                  backgroundColor={`${ACTION_COLOR[item.action] ?? "neutral"}100`}
                  textColor={`${ACTION_COLOR[item.action] ?? "neutral"}700`}
                >
                  {t(ACTION_LABEL[item.action] ?? item.action)}
                </Badge>
                {item.agentName ? (
                  <Typography variant="pi" textColor="neutral600">
                    · {item.agentName}
                  </Typography>
                ) : null}
                <Typography variant="pi" textColor="neutral500" style={{ marginLeft: "auto" }}>
                  {absoluteTime(item.createdAt, loc)} ({relativeTime(item.createdAt, t, loc)})
                </Typography>
              </Flex>

              <Box>
                <Typography variant="sigma" textColor="neutral600">
                  {t("audit.col.resumen")}
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
                    {t("audit.postAsociado")}
                  </Typography>
                  <Box marginTop={1}>
                    <Typography variant="omega" textColor="neutral800">
                      {item.postTitle ?? t("audit.sinTitulo")}
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
                    {t("audit.metadata")}
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
            <Button variant="tertiary">{t("comun.cerrar")}</Button>
          </Modal.Close>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

// Tarjeta apilada para mobile: la tabla de 7 columnas sólo mostraba Fecha+Rol
// en un celular. Acá cada acción entra completa.
function AuditCard({ item, onDetail }: { item: AuditItem; onDetail: () => void }) {
  const t = useT();
  const loc = useLocaleFechas();
  return (
    <Box background="neutral0" borderColor="neutral200" borderWidth="1px" borderStyle="solid" hasRadius padding={3} shadow="tableShadow">
      <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Flex gap={1} wrap="wrap">
          <Badge backgroundColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}100`} textColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}700`}>
            {t(ROLE_LABEL[item.agentRole] ?? item.agentRole)}
          </Badge>
          <Badge backgroundColor={`${ACTION_COLOR[item.action] ?? "neutral"}100`} textColor={`${ACTION_COLOR[item.action] ?? "neutral"}700`}>
            {t(ACTION_LABEL[item.action] ?? item.action)}
          </Badge>
        </Flex>
        <IconButton label={t("audit.verDetalle")} variant="ghost" onClick={onDetail}>
          <Eye />
        </IconButton>
      </Flex>

      <Box marginTop={2}>
        <Typography variant="omega" textColor="neutral800" style={{ overflowWrap: "anywhere" }}>
          {item.summary}
        </Typography>
      </Box>

      <Flex gap={2} wrap="wrap" marginTop={2}>
        {item.agentName ? (
          <Typography variant="pi" textColor="neutral600">
            {item.agentName}
          </Typography>
        ) : null}
        <Typography variant="pi" textColor="neutral500">
          · {absoluteTime(item.createdAt, loc)} ({relativeTime(item.createdAt, t, loc)})
        </Typography>
      </Flex>

      {item.postTitle ? (
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral500" style={{ overflowWrap: "anywhere" }}>
            {t("audit.postX", { titulo: item.postTitle })}
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

export default function AuditPage() {
  const t = useT();
  const loc = useLocaleFechas();
  const isMobile = useIsMobile();
  const { get } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

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
      toggleNotification({ type: "danger", message: t("audit.err.cargar") });
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
        title={t("audit.titulo")}
        subtitle={t("audit.subtitulo")}
        actions={
          <Flex gap={2}>
            {/* La página ya no está en el menú lateral: sin esta vuelta explícita
                el único regreso sería el back del navegador. */}
            <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate("/ai-agents")}>
              {t("audit.volverAgentes")}
            </Button>
            <Button variant="tertiary" onClick={fetchPage}>
              {t("audit.refrescar")}
            </Button>
          </Flex>
        }
      />

      <Flex gap={3} marginBottom={4} wrap="wrap" alignItems="flex-end">
        <Box minWidth={220}>
          <Field.Root>
            <Field.Label>{t("audit.col.rol")}</Field.Label>
            <SingleSelect
              value={roleFilter}
              onChange={(v: string | number) => setRoleFilter(String(v))}
            >
              <SingleSelectOption value="all">{t("audit.todosRoles")}</SingleSelectOption>
              {ALL_ROLES.map((r) => (
                <SingleSelectOption key={r.value} value={r.value}>
                  {t(r.label)}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Field.Root>
        </Box>
        <Box minWidth={220}>
          <Field.Root>
            <Field.Label>{t("comun.accion")}</Field.Label>
            <SingleSelect
              value={actionFilter}
              onChange={(v: string | number) => setActionFilter(String(v))}
            >
              <SingleSelectOption value="all">{t("audit.todasAcciones")}</SingleSelectOption>
              {Object.entries(ACTION_LABEL).map(([accion, clave]) => (
                <SingleSelectOption key={accion} value={accion}>
                  {t(clave)}
                </SingleSelectOption>
              ))}
            </SingleSelect>
          </Field.Root>
        </Box>
      </Flex>

      {loading ? (
        <Flex justifyContent="center" alignItems="center" minHeight="40vh">
          <Loader>{t("comun.cargando")}</Loader>
        </Flex>
      ) : items.length === 0 ? (
        <Box marginTop={6} background="neutral0" hasRadius shadow="filterShadow">
          <EmptyState
            icon={<Eye width="1.5rem" height="1.5rem" />}
            title={t("audit.vacio.titulo")}
            description={t("audit.vacio.desc")}
          />
        </Box>
      ) : (
        <>
          {isMobile ? (
            <Flex direction="column" alignItems="stretch" gap={2}>
              {items.map((item) => (
                <AuditCard key={item.id} item={item} onDetail={() => setDetail(item)} />
              ))}
            </Flex>
          ) : (
          <Box background="neutral0" hasRadius shadow="tableShadow">
            <Table colCount={7} rowCount={items.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.fecha")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.rol")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("comun.accion")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.agente")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.resumen")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.post")}</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">{t("audit.col.detalle")}</Typography>
                  </Th>
                </Tr>
              </Thead>
              <Tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td>
                      <Box>
                        <Typography variant="pi" fontWeight="bold" textColor="neutral800">
                          {absoluteTime(item.createdAt, loc)}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="pi" textColor="neutral500">
                          {relativeTime(item.createdAt, t, loc)}
                        </Typography>
                      </Box>
                    </Td>
                    <Td>
                      <Badge
                        backgroundColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}100`}
                        textColor={`${ROLE_COLOR[item.agentRole] ?? "neutral"}700`}
                      >
                        {t(ROLE_LABEL[item.agentRole] ?? item.agentRole)}
                      </Badge>
                    </Td>
                    <Td>
                      <Badge
                        backgroundColor={`${ACTION_COLOR[item.action] ?? "neutral"}100`}
                        textColor={`${ACTION_COLOR[item.action] ?? "neutral"}700`}
                      >
                        {t(ACTION_LABEL[item.action] ?? item.action)}
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
                      <IconButton label={t("audit.verDetalle")} onClick={() => setDetail(item)}>
                        <Eye />
                      </IconButton>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
          )}

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
                  aria-label={t("audit.filasPorPagina")}
                  value={String(pageSize)}
                  onChange={(v: string | number) => setPageSize(Number(v))}
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <SingleSelectOption key={n} value={String(n)}>
                      {n} / {t("audit.pagina")}
                    </SingleSelectOption>
                  ))}
                </SingleSelect>
              </Box>
              <Typography variant="pi" textColor="neutral600">
                {t("audit.totalPaginas", {
                  total: pagination.total,
                  pagina: pagination.page,
                  paginas: pagination.pageCount,
                })}
              </Typography>
            </Flex>

            <Pagination activePage={pagination.page} pageCount={pagination.pageCount}>
              <PreviousLink
                tag="button"
                type="button"
                onClick={() => goToPage(pagination.page - 1)}
              >
                {t("comun.anterior")}
              </PreviousLink>
              {visiblePages(pagination.page, pagination.pageCount).map((p, i) =>
                p === "dots" ? (
                  <Dots key={`dots-${i}`}>{t("audit.masPaginas")}</Dots>
                ) : (
                  <PageLink
                    key={p}
                    number={p}
                    tag="button"
                    type="button"
                    onClick={() => goToPage(p)}
                  >
                    {t("comun.irAPagina", { n: p })}
                  </PageLink>
                ),
              )}
              <NextLink
                tag="button"
                type="button"
                onClick={() => goToPage(pagination.page + 1)}
              >
                {t("comun.siguiente")}
              </NextLink>
            </Pagination>
          </Flex>
        </>
      )}

      <DetailModal item={detail} onClose={() => setDetail(null)} />
    </PageContainer>
  );
}
