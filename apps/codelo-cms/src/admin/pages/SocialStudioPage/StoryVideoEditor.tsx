import * as React from "react";
import { Box, Button, Field, Flex, Textarea, TextInput, Typography } from "@strapi/design-system";
import { ArrowClockwise, Check, Download } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { AccentCard, GroupLabel } from "../../components/ui";
import { TEMPLATE_FIELDS, type Slide, type StoryVideoResult } from "./types";

// Historia en formato video: la placa va sobreimpresa sobre el clip. Se editan
// los textos de la placa y "Recomponer" reusa el clip ya generado ($0 de IA,
// solo se re-renderiza la placa transparente + ffmpeg).
export default function StoryVideoEditor({
  jobId,
  result,
  onRecompose,
  onSaved,
}: {
  jobId: string;
  result: StoryVideoResult;
  onRecompose: (slide: Slide, clipFileId: number) => void;
  onSaved: (url: string | null) => void;
}) {
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [slide, setSlide] = React.useState<Slide>(result.slide);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const videoUrl = `/api/social-studio/jobs/${jobId}/video`;
  const fields = TEMPLATE_FIELDS[slide.template] ?? [];
  const items = (slide.items as string[]) ?? null;

  const setField = (key: string, value: string) => {
    setSlide((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const setItem = (i: number, value: string) => {
    setSlide((prev) => {
      const list = [...((prev.items as string[]) ?? [])];
      list[i] = value;
      return { ...prev, items: list };
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await post("/api/social-studio/save", { format: "reel", jobId });
      toggleNotification({ type: "success", message: "Historia (video) guardada en Medios." });
      onSaved((data as { url: string | null }).url ?? null);
    } catch (err) {
      toggleNotification({
        type: "danger",
        message: (err as Error).message || "Error al guardar. Probá recomponer (es gratis).",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccentCard
      title={`Historia (video) — ${result.seconds}s · 1080×1920`}
      description="Editá los textos de la placa y recomponé: reusa el clip ya generado, así que no vuelve a gastar IA (solo ffmpeg)."
      accent="success"
      actions={
        <Button
          variant="secondary"
          startIcon={<ArrowClockwise />}
          disabled={!dirty}
          onClick={() => onRecompose(slide, result.clipFileId)}
        >
          Recomponer (gratis)
        </Button>
      }
    >
      <Flex gap={5} alignItems="flex-start" wrap="wrap">
        <Box style={{ width: 240, flexShrink: 0 }}>
          <video
            src={videoUrl}
            controls
            loop
            style={{ width: "100%", borderRadius: 8, display: "block", aspectRatio: "9/16", background: "#000" }}
          />
        </Box>
        <Box style={{ flex: 1, minWidth: 260 }}>
          <GroupLabel>Placa · {slide.template}</GroupLabel>
          <Flex direction="column" alignItems="stretch" gap={3} marginTop={2}>
            {fields.map((f) => (
              <Field.Root key={f.key}>
                <Field.Label>{f.label}</Field.Label>
                {f.multiline ? (
                  <Textarea value={(slide[f.key] as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField(f.key, e.target.value)} />
                ) : (
                  <TextInput value={(slide[f.key] as string) ?? ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField(f.key, e.target.value)} />
                )}
              </Field.Root>
            ))}
            {items
              ? items.map((it, i) => (
                  <Field.Root key={`item-${i}`}>
                    <Field.Label>Punto {i + 1}</Field.Label>
                    <TextInput value={it} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItem(i, e.target.value)} />
                  </Field.Root>
                ))
              : null}
            <Typography variant="pi" textColor="neutral500">
              El clip quedó en AI Backgrounds — recomponer no vuelve a pagar IA.
            </Typography>
            <Flex justifyContent="flex-end" gap={2} marginTop={2} wrap="wrap">
              <Button
                size="L"
                startIcon={<Download />}
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = `${videoUrl}?download=1`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                Descargar video
              </Button>
              <Button size="L" variant="secondary" startIcon={<Check />} loading={saving} onClick={save}>
                Guardar en Medios
              </Button>
            </Flex>
          </Flex>
        </Box>
      </Flex>
    </AccentCard>
  );
}
