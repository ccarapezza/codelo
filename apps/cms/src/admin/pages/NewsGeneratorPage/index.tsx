import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextInput,
  Textarea,
  Field,
  Typography,
  Flex,
  Switch,
  Loader,
} from "@strapi/design-system";
import { Magic, Feather, Pencil, Images, ArrowClockwise } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, AccentCard, Hairline } from "../../components/ui";
import { useT } from "../../i18n";

type Note = { title: string; excerpt: string; content: string };
type Source = { title: string; url: string };
type Cover = { mediaId: number; url: string | null; prompt: string };

const GENERATE = "/api/news-generator/generate";
const REFINE = "/api/news-generator/refine";
const IMAGE = "/api/news-generator/image";
const SAVE = "/api/news-generator/save";

export default function NewsGeneratorPage() {
  const t = useT();
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const [prompt, setPrompt] = React.useState("");
  const [webSearch, setWebSearch] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);

  const [note, setNote] = React.useState<Note | null>(null);
  const [sources, setSources] = React.useState<Source[]>([]);

  const [instruction, setInstruction] = React.useState("");
  const [refineWeb, setRefineWeb] = React.useState(false);
  const [refining, setRefining] = React.useState(false);

  const [customImagePrompt, setCustomImagePrompt] = React.useState("");
  const [imageBusy, setImageBusy] = React.useState(false);
  const [cover, setCover] = React.useState<Cover | null>(null);

  const [saving, setSaving] = React.useState(false);

  const setField = (k: keyof Note, v: string) => setNote(n => (n ? { ...n, [k]: v } : n));

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await post(GENERATE, { prompt, webSearch });
      setNote({ title: data.title, excerpt: data.excerpt ?? "", content: data.content });
      setSources(Array.isArray(data.sources) ? data.sources : []);
      toggleNotification({ type: "success", message: t("gen.ok.generada") });
    } catch {
      toggleNotification({ type: "danger", message: t("gen.err.generar") });
    } finally {
      setGenerating(false);
    }
  };

  const handleRefine = async () => {
    if (!note || !instruction.trim()) return;
    setRefining(true);
    try {
      const { data } = await post(REFINE, { current: note, instruction, webSearch: refineWeb });
      setNote({ title: data.title, excerpt: data.excerpt ?? "", content: data.content });
      setInstruction("");
      toggleNotification({ type: "success", message: t("nota.ok.actualizada") });
    } catch {
      toggleNotification({ type: "danger", message: t("gen.err.refinar") });
    } finally {
      setRefining(false);
    }
  };

  const handleImage = async () => {
    if (!note) return;
    setImageBusy(true);
    try {
      const { data } = await post(IMAGE, {
        title: note.title,
        excerpt: note.excerpt,
        customPrompt: customImagePrompt.trim() || undefined,
      });
      setCover({ mediaId: data.mediaId, url: data.url, prompt: data.prompt });
      toggleNotification({ type: "success", message: t("nota.ok.imagen") });
    } catch {
      toggleNotification({ type: "danger", message: t("gen.err.imagen") });
    } finally {
      setImageBusy(false);
    }
  };

  const handleSave = async (publish: boolean) => {
    if (!note) return;
    setSaving(true);
    try {
      const { data } = await post(SAVE, {
        title: note.title,
        excerpt: note.excerpt,
        content: note.content,
        coverImageId: cover?.mediaId,
        coverPrompt: cover?.prompt,
        publish,
      });
      toggleNotification({
        type: "success",
        message: publish ? "Nota publicada." : "Borrador guardado.",
      });
      // Ir a Notas, NO al Content Manager. Abrir el entry del CM (window.open)
      // le tira 403 "Whoops!" a los roles author/editor: el rol Author sólo
      // puede abrir sus propios entries, y el pipeline los crea con otro dueño.
      // Notas es la pantalla curada donde cualquier rol gestiona la nota.
      navigate("/notas");
    } catch {
      toggleNotification({ type: "danger", message: t("gen.err.guardar") });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setNote(null);
    setSources([]);
    setInstruction("");
    setCustomImagePrompt("");
    setCover(null);
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Magic />}
        title={t("gen.titulo")}
        subtitle={t("gen.subtitulo")}
        accent="primary"
      />

      {/* 1 — Prompt */}
      <Box marginBottom={6}>
        <AccentCard title={t("gen.paso1")} icon={<Feather />} accent="primary">
          <Field.Root hint={t("gen.pedido.hint")}>
            <Field.Label>{t("nota.pedido")}</Field.Label>
            <Textarea
              rows={4}
              placeholder={t("gen.pedido.placeholder")}
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
                aria-label={t("nota.buscarWeb")}
              />
              <Typography variant="omega" textColor="neutral700">
                {t("nota.buscarWeb")}
              </Typography>
            </Flex>
            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={!prompt.trim() || generating}
              startIcon={<Magic />}
              size="L"
            >
              {generating ? t("comun.generando") : t("gen.generarNota")}
            </Button>
          </Flex>
        </AccentCard>
      </Box>

      {generating && !note ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>{t("gen.generando")}</Loader>
        </Flex>
      ) : null}

      {note ? (
        <>
          {/* 2 — Preview + edición */}
          <Box marginBottom={6}>
            <AccentCard
              title={t("gen.paso2")}
              icon={<Pencil />}
              accent="secondary"
              actions={
                <Button variant="tertiary" onClick={handleReset} disabled={saving}>{t("gen.empezarDeNuevo")}</Button>
              }
            >
              <Flex direction="column" gap={4} alignItems="stretch">
                <Field.Root>
                  <Field.Label>{t("comun.titulo")}</Field.Label>
                  <TextInput
                    value={note.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setField("title", e.target.value)
                    }
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>{t("nota.bajada")}</Field.Label>
                  <Textarea
                    rows={2}
                    value={note.excerpt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setField("excerpt", e.target.value)
                    }
                  />
                </Field.Root>
                <Field.Root hint={t("gen.cuerpo.hint")}>
                  <Field.Label>{t("gen.cuerpoMarkdown")}</Field.Label>
                  <Textarea
                    rows={18}
                    value={note.content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setField("content", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>

                {sources.length > 0 ? (
                  <Box>
                    <Hairline marginY={3} />
                    <Typography variant="sigma" textColor="neutral600">
                      {t("gen.fuentes")}
                    </Typography>
                    <Flex direction="column" gap={1} marginTop={2} alignItems="flex-start">
                      {sources.map(s => (
                        <a key={s.url} href={s.url} target="_blank" rel="noreferrer">
                          <Typography variant="pi" textColor="primary600">
                            {s.title}
                          </Typography>
                        </a>
                      ))}
                    </Flex>
                  </Box>
                ) : null}
              </Flex>
            </AccentCard>
          </Box>

          {/* 3 — Refinar con prompt */}
          <Box marginBottom={6}>
            <AccentCard
              title={t("gen.paso3")}
              icon={<ArrowClockwise />}
              accent="warning"
            >
              <Field.Root hint={t("gen.refinar.hint")}>
                <Field.Label>{t("gen.refinar.label")}</Field.Label>
                <Textarea
                  rows={2}
                  placeholder={t("gen.refinar.placeholder")}
                  value={instruction}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setInstruction(e.target.value)
                  }
                  disabled={refining}
                />
                <Field.Hint />
              </Field.Root>
              <Flex justifyContent="space-between" alignItems="center" marginTop={4} gap={4}>
                <Flex gap={2} alignItems="center">
                  <Switch
                    checked={refineWeb}
                    onCheckedChange={(v: boolean) => setRefineWeb(v)}
                    aria-label={t("gen.buscar.label")}
                  />
                  <Typography variant="omega" textColor="neutral700">{t("gen.buscar.hint")}</Typography>
                </Flex>
                <Button
                  onClick={handleRefine}
                  loading={refining}
                  disabled={!instruction.trim() || refining}
                  variant="secondary"
                  startIcon={<ArrowClockwise />}
                >
                  {refining ? t("gen.refinando") : t("gen.refinar")}
                </Button>
              </Flex>
            </AccentCard>
          </Box>

          {/* 4 — Imagen de portada */}
          <Box marginBottom={6}>
            <AccentCard title={t("gen.paso4")} icon={<Images />} accent="success">
              <Field.Root hint={t("gen.imagen.hint")}>
                <Field.Label>{t("gen.promptImagen")}</Field.Label>
                <Textarea
                  rows={2}
                  placeholder={t("gen.imagen.placeholder")}
                  value={customImagePrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setCustomImagePrompt(e.target.value)
                  }
                  disabled={imageBusy}
                />
                <Field.Hint />
              </Field.Root>
              <Flex justifyContent="flex-end" marginTop={4}>
                <Button
                  onClick={handleImage}
                  loading={imageBusy}
                  disabled={imageBusy}
                  variant="secondary"
                  startIcon={<Images />}
                >
                  {imageBusy ? t("gen.imagen.generando") : cover ? t("gen.imagen.regenerar") : t("gen.imagen.generar")}
                </Button>
              </Flex>
              {cover?.url ? (
                <Box marginTop={4}>
                  <Hairline marginY={3} />
                  <img
                    src={cover.url}
                    alt={t("gen.portadaGenerada")}
                    style={{ maxWidth: "100%", borderRadius: 8, display: "block" }}
                  />
                </Box>
              ) : null}
            </AccentCard>
          </Box>

          {/* 5 — Guardar */}
          <Box
            background="neutral0"
            padding={4}
            borderColor="neutral200"
            borderWidth="1px"
            borderStyle="solid"
            hasRadius
          >
            <Flex justifyContent="space-between" alignItems="center" gap={4}>
              <Typography variant="omega" textColor="neutral600">
                {t("gen.guardar.nota")}
              </Typography>
              <Flex gap={2}>
                <Button
                  variant="tertiary"
                  onClick={() => handleSave(false)}
                  loading={saving}
                  disabled={saving}
                >
                  {t("nota.guardarBorrador")}
                </Button>
                <Button
                  onClick={() => handleSave(true)}
                  loading={saving}
                  disabled={saving}
                  size="L"
                >
                  {t("nota.publicarAhora")}
                </Button>
              </Flex>
            </Flex>
          </Box>
        </>
      ) : null}
    </PageContainer>
  );
}
