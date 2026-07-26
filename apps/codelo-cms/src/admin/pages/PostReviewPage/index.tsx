import * as React from "react";
import { Box, Flex, Typography, Badge, Button, Loader, Tabs } from "@strapi/design-system";
import { Files, CheckCircle, Clock, Eye, EyeStriked, Calendar, User } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";

const LIST_API = "/api/post-review/list";
const PUBLISH_API = "/api/post-review/publish";
const UNPUBLISH_API = "/api/post-review/unpublish";

type Note = {
  documentId: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  tags: string[];
  author: string | null;
  publishedAt: string | null;
  createdAt: string | null;
};
type TableData = { items: Note[]; page: number; pageCount: number; total: number };
type ListResponse = { pageSize: number; published: TableData; unpublished: TableData };

const EMPTY_TABLE: TableData = { items: [], page: 1, pageCount: 1, total: 0 };

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

// El backend devuelve URLs de media relativas (/uploads/...). El panel es del
// mismo origen que el CMS, así que resuelven directo.
function coverSrc(url: string | null): string | null {
  return url ?? null;
}

// ── Fila de nota (estilo feed: texto a la izquierda, imagen a la derecha) ────
function NoteRow({
  note,
  mode,
  busy,
  onToggle,
}: {
  note: Note;
  mode: "published" | "draft";
  busy: boolean;
  onToggle: () => void;
}) {
  const src = coverSrc(note.coverUrl);
  const fecha = mode === "published" ? note.publishedAt : note.createdAt;
  const fechaLabel = mode === "published" ? "Publicada" : "Creada";
  const isMobile = useIsMobile();

  // En mobile la fila apila: imagen a lo ancho arriba, texto, y el botón a lo
  // ancho abajo. En fila (desktop) el texto quedaba en ~50px y el botón se salía.
  const imgW = isMobile ? "100%" : 168;
  const imgH = isMobile ? 160 : 100;

  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      hasRadius
      padding={4}
      shadow="tableShadow"
    >
      <Flex direction={isMobile ? "column" : "row"} gap={isMobile ? 3 : 4} alignItems="stretch">
        {/* Imagen (izquierda en desktop, arriba en mobile) */}
        <Box style={{ flexShrink: 0 }}>
          {src ? (
            <img
              src={src}
              alt=""
              loading="lazy"
              style={{ width: imgW, height: imgH, objectFit: "cover", borderRadius: 4, display: "block" }}
            />
          ) : (
            <Flex
              justifyContent="center"
              alignItems="center"
              background="neutral100"
              hasRadius
              style={{ width: imgW, height: imgH }}
            >
              <Typography variant="pi" textColor="neutral400">
                sin portada
              </Typography>
            </Flex>
          )}
        </Box>

        {/* Centro: título + subtítulo + badges */}
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Typography variant="delta" fontWeight="bold" textColor="neutral800">
            {note.title}
          </Typography>
          {note.excerpt ? (
            <Box marginTop={1}>
              <Typography
                variant="omega"
                textColor="neutral600"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {note.excerpt}
              </Typography>
            </Box>
          ) : null}

          <Flex gap={2} wrap="wrap" alignItems="center" marginTop={3}>
            {note.tags.map((t) => (
              <Badge key={t} backgroundColor="primary100" textColor="primary700">
                {t}
              </Badge>
            ))}
            {note.author ? (
              <Flex gap={1} alignItems="center">
                <Typography textColor="neutral500" style={{ display: "inline-flex" }}>
                  <User width="0.75rem" height="0.75rem" />
                </Typography>
                <Typography variant="pi" textColor="neutral600">
                  {note.author}
                </Typography>
              </Flex>
            ) : null}
            <Flex gap={1} alignItems="center">
              <Typography textColor="neutral400" style={{ display: "inline-flex" }}>
                <Calendar width="0.75rem" height="0.75rem" />
              </Typography>
              <Typography variant="pi" textColor="neutral500">
                {fechaLabel} {fmtDate(fecha)}
              </Typography>
            </Flex>
          </Flex>
        </Box>

        {/* Acción (derecha en desktop, abajo a lo ancho en mobile) */}
        <Box style={{ flexShrink: 0, width: isMobile ? "100%" : 148 }}>
          {mode === "published" ? (
            <Button
              variant="tertiary"
              size="S"
              fullWidth
              loading={busy}
              startIcon={<EyeStriked />}
              onClick={onToggle}
            >
              Despublicar
            </Button>
          ) : (
            <Button variant="success-light" size="S" fullWidth loading={busy} startIcon={<Eye />} onClick={onToggle}>
              Publicar
            </Button>
          )}
        </Box>
      </Flex>
    </Box>
  );
}

// ── Paginador compacto ───────────────────────────────────────────────────────
function Pager({
  page,
  pageCount,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  return (
    <Flex justifyContent="space-between" alignItems="center" paddingTop={2}>
      <Typography variant="pi" textColor="neutral500">
        {total} {total === 1 ? "nota" : "notas"} · página {page} de {pageCount}
      </Typography>
      <Flex gap={2}>
        <Button variant="tertiary" size="S" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Anterior
        </Button>
        <Button variant="tertiary" size="S" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          Siguiente
        </Button>
      </Flex>
    </Flex>
  );
}

// ── Cuerpo de una tabla (lista de notas + paginador) ─────────────────────────
// El título/estado y el contador los muestra la pestaña, así que acá va sólo la
// lista.
function Section({
  data,
  mode,
  busyId,
  onToggle,
  onPage,
  emptyText,
}: {
  data: TableData;
  mode: "published" | "draft";
  busyId: string | null;
  onToggle: (note: Note) => void;
  onPage: (p: number) => void;
  emptyText: string;
}) {
  return (
    <Box>
      {data.items.length === 0 ? (
        <Box background="neutral0" hasRadius shadow="tableShadow" padding={6}>
          <Typography variant="omega" textColor="neutral500">
            {emptyText}
          </Typography>
        </Box>
      ) : (
        <Flex direction="column" alignItems="stretch" gap={3}>
          {data.items.map((note) => (
            <NoteRow
              key={note.documentId}
              note={note}
              mode={mode}
              busy={busyId === note.documentId}
              onToggle={() => onToggle(note)}
            />
          ))}
        </Flex>
      )}

      <Pager page={data.page} pageCount={data.pageCount} total={data.total} onPage={onPage} />
    </Box>
  );
}

// ── Página ───────────────────────────────────────────────────────────────────
export default function PostReviewPage() {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [published, setPublished] = React.useState<TableData>(EMPTY_TABLE);
  const [unpublished, setUnpublished] = React.useState<TableData>(EMPTY_TABLE);
  const [loading, setLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pubPage, setPubPage] = React.useState(1);
  const [draftPage, setDraftPage] = React.useState(1);
  const [tab, setTab] = React.useState("publicadas");

  // Para el refresh diferido tras publicar (la portada se genera en el server de
  // forma fire-and-forget): no queremos setear estado si el usuario ya se fue.
  const mountedRef = React.useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  const load = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const { data } = await get<ListResponse>(
          `${LIST_API}?publishedPage=${pubPage}&draftPage=${draftPage}`,
        );
        setPublished(data.published);
        setUnpublished(data.unpublished);
      } catch {
        toggleNotification({ type: "danger", message: "No se pudieron cargar las notas." });
      } finally {
        setLoading(false);
      }
    },
    [get, pubPage, draftPage, toggleNotification],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (note: Note, action: "publish" | "unpublish") => {
    setBusyId(note.documentId);
    // Al publicar SIN portada, el server la genera con el agente generador de
    // imágenes (fire-and-forget, ~30s). Avisamos y reprogramamos un refresh para
    // que la portada aparezca sola, sin que el usuario tenga que recargar.
    const willGenerateCover = action === "publish" && !note.coverUrl;
    try {
      await post(action === "publish" ? PUBLISH_API : UNPUBLISH_API, { documentId: note.documentId });
      toggleNotification({
        type: "success",
        message:
          action !== "publish"
            ? "Nota despublicada."
            : willGenerateCover
              ? "Nota publicada. Generando la portada con el agente en segundo plano (~30 s)…"
              : "Nota publicada.",
      });
      // Refresca ambas tablas: la nota se mueve de una a la otra.
      await load({ silent: true });
      if (willGenerateCover) {
        window.setTimeout(() => {
          if (mountedRef.current) void load({ silent: true });
        }, 35000);
      }
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo cambiar el estado de la nota." });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Files width="1.4rem" height="1.4rem" />}
        title="Notas"
        subtitle="Verificá y publicá las notas del sitio, en orden cronológico. Para editar el contenido, usá el Content Manager."
      />

      {loading ? (
        <Flex justifyContent="center" padding={10}>
          <Loader>Cargando notas…</Loader>
        </Flex>
      ) : (
        <Tabs.Root variant="simple" value={tab} onValueChange={setTab}>
          <Tabs.List aria-label="Notas por estado">
            <Tabs.Trigger value="publicadas">
              <Flex gap={2} alignItems="center">
                <Typography textColor="success600" style={{ display: "inline-flex" }}>
                  <CheckCircle />
                </Typography>
                Publicadas
                <Badge>{published.total}</Badge>
              </Flex>
            </Tabs.Trigger>
            <Tabs.Trigger value="borradores">
              <Flex gap={2} alignItems="center">
                <Typography textColor="warning600" style={{ display: "inline-flex" }}>
                  <Clock />
                </Typography>
                Sin publicar
                <Badge>{unpublished.total}</Badge>
              </Flex>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="publicadas">
            <Box paddingTop={4}>
              <Section
                data={published}
                mode="published"
                busyId={busyId}
                onToggle={(n) => handleToggle(n, "unpublish")}
                onPage={setPubPage}
                emptyText="No hay notas publicadas."
              />
            </Box>
          </Tabs.Content>

          <Tabs.Content value="borradores">
            <Box paddingTop={4}>
              <Section
                data={unpublished}
                mode="draft"
                busyId={busyId}
                onToggle={(n) => handleToggle(n, "publish")}
                onPage={setDraftPage}
                emptyText="No hay borradores sin publicar."
              />
            </Box>
          </Tabs.Content>
        </Tabs.Root>
      )}
    </PageContainer>
  );
}
