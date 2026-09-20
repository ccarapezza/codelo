import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Textarea,
  Field,
  Flex,
  Typography,
  Switch,
  Loader,
} from "@strapi/design-system";
import { Feather, Magic, ArrowLeft, Sparkle, Pencil } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, AccentCard } from "../../components/ui";
import { NoteForm, type NoteDraft, type TagOption } from "./NoteForm";

const GENERATE = "/api/news-generator/generate";
const REFINE = "/api/news-generator/refine";
const IMAGE = "/api/news-generator/image";
const UPLOAD = "/api/news-generator/upload";
const SAVE = "/api/news-generator/save";
const UPDATE = "/api/news-generator/update";
const LOAD = "/api/news-generator/post";
const TAGS = "/api/news-generator/tags";

const EMPTY: NoteDraft = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  tags: [],
  featured: false,
  cover: null,
};

type Mode = "ia" | "manual";

export default function NoteEditorPage() {
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();
  const location = useLocation();

  // El documentId de edición viaja como ?id=… — sin él, es creación.
  const editId = React.useMemo(
    () => new URLSearchParams(location.search).get("id"),
    [location.search],
  );
  const isEdit = Boolean(editId);

  const [draft, setDraft] = React.useState<NoteDraft>(EMPTY);
  const [tagOptions, setTagOptions] = React.useState<TagOption[]>([]);
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [loading, setLoading] = React.useState(isEdit);
  const [wasPublished, setWasPublished] = React.useState(false);

  // En creación: elige cómo arrancar. En IA, el form aparece recién tras generar.
  const [mode, setMode] = React.useState<Mode>("ia");
  const [formReady, setFormReady] = React.useState(false);

  // IA — paso de prompt
  const [prompt, setPrompt] = React.useState("");
  const [webSearch, setWebSearch] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  // Estados de las acciones del form
  const [refining, setRefining] = React.useState(false);
  const [imageBusy, setImageBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [customImagePrompt, setCustomImagePrompt] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // Cargar tags (para el selector) siempre.
  React.useEffect(() => {
    get<TagOption[]>(TAGS)
      .then(({ data }) => setTagOptions(Array.isArray(data) ? data : []))
      .catch(() => setTagOptions([]));
  }, [get]);

  // En edición: cargar la nota y mostrar el form directo.
  React.useEffect(() => {
    if (!editId) return;
    setLoading(true);
    get<{
      title: string;
      slug: string;
      excerpt: string;
      content: string;
      featured: boolean;
      published: boolean;
      cover: { mediaId: number; url: string | null } | null;
      tags: Array<{ id: number; name: string }>;
    }>(`${LOAD}?documentId=${encodeURIComponent(editId)}`)
      .then(({ data }) => {
        setDraft({
          title: data.title ?? "",
          slug: data.slug ?? "",
          excerpt: data.excerpt ?? "",
          content: data.content ?? "",
          tags: data.tags.map(t => t.id),
          featured: Boolean(data.featured),
          cover: data.cover,
        });
        setWasPublished(Boolean(data.published));
        setSlugTouched(true); // en edición el slug ya existe: no autoseguir el título
        setFormReady(true);
      })
      .catch(() => toggleNotification({ type: "danger", message: "No se pudo cargar la nota." }))
      .finally(() => setLoading(false));
  }, [editId, get, toggleNotification]);

  const goManual = () => {
    setMode("manual");
    setDraft(EMPTY);
    setSlugTouched(false);
    setFormReady(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await post(GENERATE, { prompt, webSearch });
      setDraft({
        ...EMPTY,
        title: data.title ?? "",
        slug: data.title ? "" : "", // se autogenera al mostrar; el form lo recalcula del título
        excerpt: data.excerpt ?? "",
        content: data.content ?? "",
      });
      // Forzar el slug inicial desde el título generado.
      setDraft(d => ({ ...d, slug: slugFromTitle(d.title) }));
      setSlugTouched(false);
      setFormReady(true);
      toggleNotification({ type: "success", message: "Nota generada. Revisá y ajustá abajo." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló la generación." });
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async (instruction: string, web: boolean) => {
    setRefining(true);
    try {
      const { data } = await post(REFINE, {
        current: { title: draft.title, excerpt: draft.excerpt, content: draft.content },
        instruction,
        webSearch: web,
      });
      setDraft(d => ({
        ...d,
        title: data.title ?? d.title,
        excerpt: data.excerpt ?? d.excerpt,
        content: data.content ?? d.content,
      }));
      toggleNotification({ type: "success", message: "Nota actualizada." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló el refinamiento." });
    } finally {
      setRefining(false);
    }
  };

  const handleGenerateImage = async () => {
    setImageBusy(true);
    try {
      const { data } = await post(IMAGE, {
        title: draft.title,
        excerpt: draft.excerpt,
        customPrompt: customImagePrompt.trim() || undefined,
      });
      setDraft(d => ({
        ...d,
        cover: { mediaId: data.mediaId, url: data.url },
        coverPrompt: data.prompt,
      }));
      toggleNotification({ type: "success", message: "Imagen generada." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló la generación de imagen." });
    } finally {
      setImageBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await post(UPLOAD, form);
      setDraft(d => ({
        ...d,
        cover: { mediaId: data.mediaId, url: data.url },
        coverPrompt: undefined,
      }));
      toggleNotification({ type: "success", message: "Imagen subida." });
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo subir la imagen." });
    } finally {
      setUploading(false);
    }
  };

  const canSave = draft.title.trim() && draft.content.trim();
  const hasCover = Boolean(draft.cover);

  const handleSave = async (publish: boolean) => {
    if (!canSave) {
      toggleNotification({ type: "warning", message: "Falta el título o el cuerpo." });
      return;
    }
    if (publish && !hasCover) {
      toggleNotification({
        type: "warning",
        message: "Para publicar, la nota necesita una imagen.",
      });
      return;
    }
    setSaving(true);
    try {
      if (isEdit && editId) {
        await post(UPDATE, {
          documentId: editId,
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt,
          content: draft.content,
          coverImageId: draft.cover ? draft.cover.mediaId : null,
          tags: draft.tags,
          featured: draft.featured,
        });
        toggleNotification({ type: "success", message: "Cambios guardados." });
      } else {
        await post(SAVE, {
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt,
          content: draft.content,
          coverImageId: draft.cover?.mediaId,
          coverPrompt: draft.coverPrompt,
          tags: draft.tags,
          featured: draft.featured,
          publish,
        });
        toggleNotification({
          type: "success",
          message: publish ? "Nota publicada." : "Borrador guardado.",
        });
      }
      navigate("/notas");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? "No se pudo guardar.";
      toggleNotification({ type: "danger", message: msg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <Flex justifyContent="center" padding={10}>
          <Loader>Cargando la nota…</Loader>
        </Flex>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={isEdit ? <Pencil /> : <Feather />}
        title={isEdit ? "Editar nota" : "Nueva nota"}
        subtitle={
          isEdit
            ? "Modificá el contenido, las etiquetas y la imagen. Si la nota está publicada, los cambios salen a la web al guardar."
            : "Creá una nota con ayuda de la IA o escribila a mano."
        }
        accent="primary"
        actions={
          <Button variant="tertiary" startIcon={<ArrowLeft />} onClick={() => navigate("/notas")}>
            Volver a Notas
          </Button>
        }
      />

      {/* Selector de modo — sólo en creación y antes de que el form aparezca. */}
      {!isEdit && !formReady ? (
        <Box marginBottom={6}>
          <Flex gap={4} wrap="wrap">
            <ModeCard
              active={mode === "ia"}
              onClick={() => setMode("ia")}
              icon={<Magic />}
              title="Con IA"
              text="Escribí un pedido y el modelo redacta el borrador. Después lo editás."
            />
            <ModeCard
              active={mode === "manual"}
              onClick={goManual}
              icon={<Pencil />}
              title="A mano"
              text="Abrí el formulario vacío y escribí la nota vos."
            />
          </Flex>
        </Box>
      ) : null}

      {/* Paso IA: prompt. Sólo en creación-IA y antes de generar. */}
      {!isEdit && mode === "ia" && !formReady ? (
        <Box marginBottom={6}>
          <AccentCard title="Pedido a la IA" icon={<Sparkle />} accent="primary">
            <Field.Root hint="Describí la nota que querés. Ej: 'Novedades sobre REPROCANN y los plazos actuales'.">
              <Field.Label>Pedido</Field.Label>
              <Textarea
                rows={4}
                placeholder="Escribí el pedido de la nota…"
                value={prompt}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                disabled={generating}
              />
              <Field.Hint />
            </Field.Root>
            <Flex justifyContent="space-between" alignItems="center" marginTop={4} gap={4}>
              <Flex gap={2} alignItems="center">
                <Switch
                  checked={webSearch}
                  onCheckedChange={(v: boolean) => setWebSearch(v)}
                  aria-label="Buscar fuentes en internet"
                />
                <Typography variant="omega" textColor="neutral700">
                  Buscar fuentes en internet
                </Typography>
              </Flex>
              <Button
                onClick={handleGenerate}
                loading={generating}
                disabled={!prompt.trim() || generating}
                startIcon={<Magic />}
                size="L"
              >
                {generating ? "Generando…" : "Generar borrador"}
              </Button>
            </Flex>
          </AccentCard>
        </Box>
      ) : null}

      {generating && !formReady ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>Redactando la nota…</Loader>
        </Flex>
      ) : null}

      {/* El form compartido. */}
      {formReady ? (
        <>
          <NoteForm
            draft={draft}
            setDraft={setDraft}
            tagOptions={tagOptions}
            slugTouched={slugTouched}
            onSlugTouched={() => setSlugTouched(true)}
            onRefine={handleRefine}
            refining={refining}
            onGenerateImage={handleGenerateImage}
            imageBusy={imageBusy}
            onUpload={handleUpload}
            uploading={uploading}
            customImagePrompt={customImagePrompt}
            setCustomImagePrompt={setCustomImagePrompt}
          />

          {/* Barra de guardado. */}
          <Box
            marginTop={6}
            background="neutral0"
            padding={4}
            borderColor="neutral200"
            borderWidth="1px"
            borderStyle="solid"
            hasRadius
          >
            <Flex justifyContent="space-between" alignItems="center" gap={4} wrap="wrap">
              <Typography variant="omega" textColor="neutral600">
                {isEdit
                  ? wasPublished
                    ? "La nota está publicada: al guardar, los cambios salen a la web."
                    : "Borrador. Guardá los cambios; publicás desde Notas cuando quieras."
                  : hasCover
                    ? "Guardá como borrador para revisar, o publicá directo."
                    : "Generá o subí una imagen para poder publicar."}
              </Typography>
              <Flex gap={2}>
                {isEdit ? (
                  <Button
                    onClick={() => handleSave(false)}
                    loading={saving}
                    disabled={saving || !canSave}
                    size="L"
                  >
                    Guardar cambios
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="tertiary"
                      onClick={() => handleSave(false)}
                      loading={saving}
                      disabled={saving || !canSave}
                    >
                      Guardar borrador
                    </Button>
                    <Button
                      onClick={() => handleSave(true)}
                      loading={saving}
                      disabled={saving || !canSave || !hasCover}
                      size="L"
                    >
                      Publicar ahora
                    </Button>
                  </>
                )}
              </Flex>
            </Flex>
          </Box>
        </>
      ) : null}
    </PageContainer>
  );
}

// Slug local para el prellenado inicial desde el título generado por IA.
function slugFromTitle(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  text,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Box
      onClick={onClick}
      background="neutral0"
      borderColor={active ? "primary500" : "neutral200"}
      borderWidth={active ? "2px" : "1px"}
      borderStyle="solid"
      hasRadius
      padding={5}
      style={{ cursor: "pointer", flex: 1, minWidth: 240 }}
    >
      <Flex gap={3} alignItems="center">
        <Box
          background={active ? "primary100" : "neutral100"}
          hasRadius
          style={{
            width: 40,
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography textColor={active ? "primary600" : "neutral600"}>{icon}</Typography>
        </Box>
        <Typography variant="delta" textColor="neutral800">
          {title}
        </Typography>
      </Flex>
      <Box marginTop={3}>
        <Typography variant="omega" textColor="neutral600">
          {text}
        </Typography>
      </Box>
    </Box>
  );
}
