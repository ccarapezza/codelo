import * as React from "react";
import { Box, Flex, Typography, Badge, Button, Loader, Tabs, Switch, Modal } from "@strapi/design-system";
import { Files, CheckCircle, Clock, Eye, EyeStriked, Calendar, User, Images } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";

const LIST_API = "/api/post-review/list";
const PUBLISH_API = "/api/post-review/publish";
const UNPUBLISH_API = "/api/post-review/unpublish";
// Regenera la portada con el agente generador de imágenes (fire-and-forget).
const GENERATE_COVER_API = "/api/post/generate-cover";
// Marca/desmarca la nota como destacada (carrusel de la home).
const SET_FEATURED_API = "/api/post-review/set-featured";
// Devuelve la URL de vista previa de la web (con el secret) para embeber en el iframe.
const PREVIEW_URL_API = "/api/post-review/preview-url";

type Note = {
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
  generating,
  featuring,
  previewing,
  onToggle,
  onGenerateImage,
  onToggleFeatured,
  onPreview,
}: {
  note: Note;
  mode: "published" | "draft";
  busy: boolean;
  generating: boolean;
  featuring: boolean;
  previewing: boolean;
  onToggle: () => void;
  onGenerateImage: () => void;
  onToggleFeatured: (next: boolean) => void;
  onPreview: () => void;
}) {
  const hasCover = Boolean(note.coverUrl);
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

        {/* Acciones (derecha en desktop, abajo a lo ancho en mobile) */}
        <Flex
          direction="column"
          gap={2}
          style={{ flexShrink: 0, width: isMobile ? "100%" : 170 }}
        >
          {/* Destacar en el carrusel de la home (solo aplica a publicadas). */}
          {mode === "published" ? (
            <Flex justifyContent="space-between" alignItems="center" gap={2}>
              <Typography variant="pi" textColor={note.featured ? "success600" : "neutral500"}>
                En carrusel
              </Typography>
              <Switch
                checked={note.featured}
                onCheckedChange={(v: boolean) => onToggleFeatured(v)}
                disabled={featuring}
                aria-label={note.featured ? "Quitar del carrusel" : "Agregar al carrusel"}
              />
            </Flex>
          ) : null}

          {/* Vista previa: abre la nota renderizada por la web real (borradores
              incluidos, vía draftMode) en un iframe. */}
          <Button
            variant="tertiary"
            size="S"
            fullWidth
            loading={previewing}
            disabled={busy || generating}
            startIcon={<Eye />}
            onClick={onPreview}
          >
            Vista previa
          </Button>

          {/* Imagen: generar o regenerar con el agente generador de imágenes. */}
          <Button
            variant="secondary"
            size="S"
            fullWidth
            loading={generating}
            disabled={busy}
            startIcon={<Images />}
            onClick={onGenerateImage}
          >
            {hasCover ? "Regenerar imagen" : "Generar imagen"}
          </Button>

          {mode === "published" ? (
            <Button
              variant="tertiary"
              size="S"
              fullWidth
              loading={busy}
              disabled={generating}
              startIcon={<EyeStriked />}
              onClick={onToggle}
            >
              Despublicar
            </Button>
          ) : (
            <>
              {/* Publicar deshabilitado hasta que la nota tenga imagen. */}
              <Button
                variant="success-light"
                size="S"
                fullWidth
                loading={busy}
                disabled={!hasCover || generating}
                startIcon={<Eye />}
                onClick={onToggle}
              >
                Publicar
              </Button>
              {!hasCover ? (
                <Typography variant="pi" textColor="neutral500" style={{ textAlign: "center" }}>
                  Generá la imagen para poder publicar
                </Typography>
              ) : null}
            </>
          )}
        </Flex>
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
  generatingId,
  featuringId,
  previewingId,
  onToggle,
  onGenerateImage,
  onToggleFeatured,
  onPreview,
  onPage,
  emptyText,
}: {
  data: TableData;
  mode: "published" | "draft";
  busyId: string | null;
  generatingId: string | null;
  featuringId: string | null;
  previewingId: string | null;
  onToggle: (note: Note) => void;
  onGenerateImage: (note: Note) => void;
  onToggleFeatured: (note: Note, next: boolean) => void;
  onPreview: (note: Note) => void;
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
              generating={generatingId === note.documentId}
              featuring={featuringId === note.documentId}
              previewing={previewingId === note.documentId}
              onToggle={() => onToggle(note)}
              onGenerateImage={() => onGenerateImage(note)}
              onToggleFeatured={(next) => onToggleFeatured(note, next)}
              onPreview={() => onPreview(note)}
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
  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const [featuringId, setFeaturingId] = React.useState<string | null>(null);
  const [previewingId, setPreviewingId] = React.useState<string | null>(null);
  // Nota abierta en el modal de vista previa (título + URL a embeber).
  const [preview, setPreview] = React.useState<{ title: string; url: string } | null>(null);
  const [pubPage, setPubPage] = React.useState(1);
  const [draftPage, setDraftPage] = React.useState(1);
  const [tab, setTab] = React.useState("publicadas");

  // Para el refresh diferido tras publicar (la portada se genera en el server de
  // forma fire-and-forget): no queremos setear estado si el usuario ya se fue.
  const mountedRef = React.useRef(true);
  React.useEffect(() => () => { mountedRef.current = false; }, []);

  // El banner de la web (dentro del iframe) avisa por postMessage cuando el
  // usuario toca "Cerrar" ahí; cerramos el modal desde acá. (El banner ya limpió
  // draftMode antes de avisar.)
  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e?.data?.type === "codelo-preview-close") setPreview(null);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
    try {
      await post(action === "publish" ? PUBLISH_API : UNPUBLISH_API, { documentId: note.documentId });
      toggleNotification({
        type: "success",
        message: action === "publish" ? "Nota publicada." : "Nota despublicada.",
      });
      // Refresca ambas tablas: la nota se mueve de una a la otra.
      await load({ silent: true });
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo cambiar el estado de la nota." });
    } finally {
      setBusyId(null);
    }
  };

  // Marca/desmarca la nota como destacada (carrusel de la home). Optimista:
  // actualizamos la fila al toque y revertimos si el request falla.
  const handleToggleFeatured = async (note: Note, next: boolean) => {
    setFeaturingId(note.documentId);
    setPublished((prev) => ({
      ...prev,
      items: prev.items.map((n) => (n.documentId === note.documentId ? { ...n, featured: next } : n)),
    }));
    try {
      await post(SET_FEATURED_API, { documentId: note.documentId, featured: next });
    } catch {
      setPublished((prev) => ({
        ...prev,
        items: prev.items.map((n) => (n.documentId === note.documentId ? { ...n, featured: !next } : n)),
      }));
      toggleNotification({ type: "danger", message: "No se pudo cambiar el destacado." });
    } finally {
      setFeaturingId(null);
    }
  };

  // Abre la vista previa: pide al CMS la URL de preview de la web (arma el secret
  // del lado del server) y la embebe en el iframe del modal. La web, con esa URL,
  // activa draftMode y renderiza el BORRADOR con su propio layout.
  const handlePreview = async (note: Note) => {
    setPreviewingId(note.documentId);
    try {
      const { data } = await get<{ url: string }>(
        `${PREVIEW_URL_API}?documentId=${encodeURIComponent(note.documentId)}`,
      );
      if (!data?.url) throw new Error("sin url");
      setPreview({ title: note.title, url: data.url });
    } catch {
      toggleNotification({
        type: "danger",
        message: "No se pudo abrir la vista previa (¿falta configurar PREVIEW_SECRET / PREVIEW_WEB_URL?).",
      });
    } finally {
      setPreviewingId(null);
    }
  };

  // Genera/regenera la portada con el agente generador de imágenes. El endpoint
  // es fire-and-forget (la imagen tarda ~30 s), así que mantenemos el spinner y
  // recargamos en diferido para que la portada nueva aparezca sola.
  const handleGenerateImage = async (note: Note) => {
    setGeneratingId(note.documentId);
    try {
      await post(GENERATE_COVER_API, { documentId: note.documentId });
      toggleNotification({
        type: "success",
        message: "Generando la imagen con el agente… puede tardar ~30 s.",
      });
      window.setTimeout(() => {
        if (!mountedRef.current) return;
        setGeneratingId((cur) => (cur === note.documentId ? null : cur));
        void load({ silent: true });
      }, 35000);
    } catch {
      // Errores sincrónicos (falta OPENAI_API_KEY o el agente de imagen): el
      // endpoint responde 400 y lo avisamos de una.
      toggleNotification({ type: "danger", message: "No se pudo generar la imagen (revisá el agente / la API key)." });
      setGeneratingId(null);
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
                generatingId={generatingId}
                featuringId={featuringId}
                previewingId={previewingId}
                onToggle={(n) => handleToggle(n, "unpublish")}
                onGenerateImage={handleGenerateImage}
                onToggleFeatured={handleToggleFeatured}
                onPreview={handlePreview}
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
                generatingId={generatingId}
                featuringId={featuringId}
                previewingId={previewingId}
                onToggle={(n) => handleToggle(n, "publish")}
                onGenerateImage={handleGenerateImage}
                onToggleFeatured={handleToggleFeatured}
                onPreview={handlePreview}
                onPage={setDraftPage}
                emptyText="No hay borradores sin publicar."
              />
            </Box>
          </Tabs.Content>
        </Tabs.Root>
      )}

      {/* Modal de vista previa: embebe la web real (con draftMode) en un iframe.
          La URL ya trae el secret; la web resuelve el borrador y lo renderiza con
          su propio layout, así la preview coincide con el sitio real. */}
      <Modal.Root open={Boolean(preview)} onOpenChange={(open: boolean) => { if (!open) setPreview(null); }}>
        {preview ? (
          <Modal.Content style={{ maxWidth: "95vw", width: 1100 }}>
            <Modal.Header>
              <Modal.Title>Vista previa · {preview.title}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              <Box
                background="neutral150"
                hasRadius
                style={{ overflow: "hidden", border: "1px solid var(--strapi-neutral200, #eaeaef)" }}
              >
                <iframe
                  title="Vista previa de la nota"
                  src={preview.url}
                  style={{ width: "100%", height: "70vh", border: "none", display: "block", background: "#fff" }}
                />
              </Box>
              <Box paddingTop={2}>
                <Typography variant="pi" textColor="neutral500">
                  Estás viendo el borrador renderizado por la web real. Los cambios de diseño del sitio se reflejan acá.
                </Typography>
              </Box>
            </Modal.Body>
            <Modal.Footer>
              <Modal.Close>
                <Button variant="tertiary">Cerrar</Button>
              </Modal.Close>
              <Button variant="secondary" onClick={() => window.open(preview.url, "_blank", "noopener")}>
                Abrir en pestaña nueva
              </Button>
            </Modal.Footer>
          </Modal.Content>
        ) : null}
      </Modal.Root>
    </PageContainer>
  );
}
