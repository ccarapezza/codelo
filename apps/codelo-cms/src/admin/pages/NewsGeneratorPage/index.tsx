import * as React from "react";
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

type Note = { title: string; excerpt: string; content: string };
type Source = { title: string; url: string };
type Cover = { mediaId: number; url: string | null; prompt: string };

const GENERATE = "/api/news-generator/generate";
const REFINE = "/api/news-generator/refine";
const IMAGE = "/api/news-generator/image";
const SAVE = "/api/news-generator/save";

export default function NewsGeneratorPage() {
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();

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

  const setField = (k: keyof Note, v: string) => setNote((n) => (n ? { ...n, [k]: v } : n));

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await post(GENERATE, { prompt, webSearch });
      setNote({ title: data.title, excerpt: data.excerpt ?? "", content: data.content });
      setSources(Array.isArray(data.sources) ? data.sources : []);
      toggleNotification({ type: "success", message: "Nota generada." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló la generación." });
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
      toggleNotification({ type: "success", message: "Nota actualizada." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló el refinamiento." });
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
      toggleNotification({ type: "success", message: "Imagen generada." });
    } catch {
      toggleNotification({ type: "danger", message: "Falló la generación de imagen." });
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
      // Link to the Content Manager entry.
      const url = `/admin/content-manager/collection-types/api::post.post/${data.documentId}`;
      window.open(url, "_blank");
      handleReset();
    } catch {
      toggleNotification({ type: "danger", message: "Falló el guardado." });
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
        title="Generador de notas"
        subtitle="Generá una nota a demanda con un prompt. El modelo busca fuentes en internet, vos editás, refinás y publicás."
        accent="primary"
      />

      {/* 1 — Prompt */}
      <Box marginBottom={6}>
        <AccentCard title="1 · Prompt" icon={<Feather />} accent="primary">
          <Field.Root hint="Describí la nota que querés. Ej: 'Resumen del triunfo de Argentina y las claves del partido'.">
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
                aria-label="Buscar en internet"
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
              {generating ? "Generando…" : "Generar nota"}
            </Button>
          </Flex>
        </AccentCard>
      </Box>

      {generating && !note ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>Generando la nota…</Loader>
        </Flex>
      ) : null}

      {note ? (
        <>
          {/* 2 — Preview + edición */}
          <Box marginBottom={6}>
            <AccentCard
              title="2 · Preview y edición"
              icon={<Pencil />}
              accent="secondary"
              actions={
                <Button variant="tertiary" onClick={handleReset} disabled={saving}>
                  Empezar de nuevo
                </Button>
              }
            >
              <Flex direction="column" gap={4} alignItems="stretch">
                <Field.Root>
                  <Field.Label>Título</Field.Label>
                  <TextInput
                    value={note.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("title", e.target.value)}
                  />
                </Field.Root>
                <Field.Root>
                  <Field.Label>Bajada / excerpt</Field.Label>
                  <Textarea
                    rows={2}
                    value={note.excerpt}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("excerpt", e.target.value)}
                  />
                </Field.Root>
                <Field.Root hint="Cuerpo en Markdown. Editá libremente.">
                  <Field.Label>Cuerpo (Markdown)</Field.Label>
                  <Textarea
                    rows={18}
                    value={note.content}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField("content", e.target.value)}
                  />
                  <Field.Hint />
                </Field.Root>

                {sources.length > 0 ? (
                  <Box>
                    <Hairline marginY={3} />
                    <Typography variant="sigma" textColor="neutral600">
                      Fuentes consultadas
                    </Typography>
                    <Flex direction="column" gap={1} marginTop={2} alignItems="flex-start">
                      {sources.map((s) => (
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
            <AccentCard title="3 · Refinar con un prompt" icon={<ArrowClockwise />} accent="warning">
              <Field.Root hint="Pedí un cambio. Ej: 'Hacela más corta', 'Agregá una cita', 'Cambiá el enfoque al arquero'.">
                <Field.Label>Instrucción de modificación</Field.Label>
                <Textarea
                  rows={2}
                  placeholder="¿Qué querés cambiar?"
                  value={instruction}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInstruction(e.target.value)}
                  disabled={refining}
                />
                <Field.Hint />
              </Field.Root>
              <Flex justifyContent="space-between" alignItems="center" marginTop={4} gap={4}>
                <Flex gap={2} alignItems="center">
                  <Switch
                    checked={refineWeb}
                    onCheckedChange={(v: boolean) => setRefineWeb(v)}
                    aria-label="Buscar en internet al refinar"
                  />
                  <Typography variant="omega" textColor="neutral700">
                    Buscar fuentes (si el cambio necesita datos nuevos)
                  </Typography>
                </Flex>
                <Button
                  onClick={handleRefine}
                  loading={refining}
                  disabled={!instruction.trim() || refining}
                  variant="secondary"
                  startIcon={<ArrowClockwise />}
                >
                  {refining ? "Refinando…" : "Refinar"}
                </Button>
              </Flex>
            </AccentCard>
          </Box>

          {/* 4 — Imagen de portada */}
          <Box marginBottom={6}>
            <AccentCard title="4 · Imagen de portada" icon={<Images />} accent="success">
              <Field.Root hint="Opcional. Si lo dejás vacío, usa el agente de imagen configurado.">
                <Field.Label>Prompt custom (opcional)</Field.Label>
                <Textarea
                  rows={2}
                  placeholder="Dejalo vacío para usar el agente, o describí la imagen…"
                  value={customImagePrompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomImagePrompt(e.target.value)}
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
                  {imageBusy ? "Generando imagen…" : cover ? "Regenerar imagen" : "Generar imagen"}
                </Button>
              </Flex>
              {cover?.url ? (
                <Box marginTop={4}>
                  <Hairline marginY={3} />
                  <img
                    src={cover.url}
                    alt="Portada generada"
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
                Guardá como borrador para revisar en el Content Manager, o publicá directo (genera la versión EN).
              </Typography>
              <Flex gap={2}>
                <Button variant="tertiary" onClick={() => handleSave(false)} loading={saving} disabled={saving}>
                  Guardar borrador
                </Button>
                <Button onClick={() => handleSave(true)} loading={saving} disabled={saving} size="L">
                  Publicar ahora
                </Button>
              </Flex>
            </Flex>
          </Box>
        </>
      ) : null}
    </PageContainer>
  );
}
