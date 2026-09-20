import * as React from "react";
import { Box, Button, Field, Flex, Textarea, TextInput, Typography } from "@strapi/design-system";
import { ArrowClockwise, Check, Download } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { AccentCard, GroupLabel, Hairline } from "../../components/ui";
import { TEMPLATE_FIELDS, type DeckResult, type Slide } from "./types";

// Preview editable de carrusel/historia: los textos se modifican y se
// re-renderiza con satori SIN volver a llamar IA (el fondo ya generado se
// reusa por bgFileId). Guardar hace el render full-res del lado del server.
export default function DeckEditor({
  result,
  postDocumentId,
  onSaved,
}: {
  result: DeckResult;
  postDocumentId: string | null;
  onSaved: () => void;
}) {
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [slides, setSlides] = React.useState<Slide[]>(result.slides);
  const [caption, setCaption] = React.useState(result.caption ?? "");
  const [previews, setPreviews] = React.useState<string[]>(result.previews);
  const [rendering, setRendering] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const isCarousel = result.size === "portrait";

  const setField = (idx: number, key: string, value: string) => {
    setSlides((prev) => prev.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));
    setDirty(true);
  };

  const setItem = (idx: number, itemIdx: number, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => {
        if (i !== idx) return s;
        const items = [...((s.items as string[]) ?? [])];
        items[itemIdx] = value;
        return { ...s, items };
      }),
    );
    setDirty(true);
  };

  const rerender = async () => {
    setRendering(true);
    try {
      const { data } = await post("/api/social-studio/render-preview", {
        slides,
        size: result.size,
        bgFileId: result.bgFileId,
      });
      setPreviews((data as { previews: string[] }).previews);
      setDirty(false);
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo re-renderizar el preview." });
    } finally {
      setRendering(false);
    }
  };

  // Descarga las placas en ALTA resolución directo al disco (para subir a IG),
  // sin pasar por Media. Renderiza full-res (scale 1) y copia el caption.
  // Usa blob URLs (no data: URIs) — Chrome bloquea descargas múltiples de
  // data: URIs; con blobs pregunta una vez "¿descargar varios?" y baja todas.
  const download = async () => {
    setDownloading(true);
    const urls: string[] = [];
    try {
      // Renderizamos UNA placa por request (no las 4 juntas): el full-res de las
      // 4 en un solo JSON daba ~10MB y se cortaba la conexión (ECONNRESET).
      let done = 0;
      for (let i = 0; i < slides.length; i++) {
        const { data } = await post("/api/social-studio/render-preview", {
          slides: [slides[i]],
          size: result.size,
          bgFileId: result.bgFileId,
          scale: 1,
        });
        const uri = (data as { previews: string[] }).previews?.[0];
        if (!uri) continue;
        const blob = await (await fetch(uri)).blob();
        const url = URL.createObjectURL(blob);
        urls.push(url);
        const a = document.createElement("a");
        a.href = url;
        a.download = `placa-${String(i + 1).padStart(2, "0")}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        done++;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (caption) await navigator.clipboard?.writeText(caption).catch(() => {});
      toggleNotification({
        type: "success",
        message: `${done} placas descargadas${caption ? " · caption copiado" : ""}. Si el navegador pregunta, permití "descargar varios archivos".`,
      });
    } catch {
      toggleNotification({ type: "danger", message: "No se pudieron descargar las placas." });
    } finally {
      setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 10_000);
      setDownloading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const format = isCarousel ? "carrusel" : "historia";
      const { data } = await post("/api/social-studio/save", {
        format,
        postDocumentId: postDocumentId ?? undefined,
        slides,
        caption,
        coverPrompt: result.coverPrompt ?? null,
        bgFileId: result.bgFileId,
      });
      void data;
      toggleNotification({
        type: "success",
        message: isCarousel ? "Carrusel guardado en la nota y en Medios." : "Historia guardada en Medios.",
      });
      onSaved();
    } catch (err) {
      toggleNotification({ type: "danger", message: (err as Error).message || "Error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Flex direction="column" alignItems="stretch" gap={4}>
      <AccentCard
        title={isCarousel ? `Carrusel — ${slides.length} placas` : "Historia — 1080×1920"}
        description="Editá los textos y actualizá la vista previa (gratis, no llama a la IA). Cuando esté listo: descargá las placas para subirlas a Instagram, o guardalas en la nota."
        accent="success"
        actions={
          <Button
            variant="secondary"
            startIcon={<ArrowClockwise />}
            loading={rendering}
            disabled={!dirty}
            onClick={rerender}
          >
            Actualizar vista previa
          </Button>
        }
      >
        <Flex direction="column" alignItems="stretch" gap={5}>
          {slides.map((slide, idx) => {
            const fields = TEMPLATE_FIELDS[slide.template] ?? [];
            const items = (slide.items as string[]) ?? null;
            return (
              <Box key={idx}>
                <Flex gap={4} alignItems="flex-start" wrap="wrap">
                  <Box style={{ width: 200, flexShrink: 0 }}>
                    {previews[idx] ? (
                      // eslint-disable-next-line jsx-a11y/alt-text
                      <img
                        src={previews[idx]}
                        style={{
                          width: "100%",
                          borderRadius: 8,
                          border: "1px solid var(--neutral200, rgba(128,128,128,0.25))",
                          opacity: dirty ? 0.6 : 1,
                          display: "block",
                        }}
                      />
                    ) : null}
                  </Box>
                  <Box style={{ flex: 1, minWidth: 260 }}>
                    <GroupLabel>
                      Placa {idx + 1} · {slide.template}
                    </GroupLabel>
                    <Flex direction="column" alignItems="stretch" gap={3} marginTop={2}>
                      {fields.map((f) => (
                        <Field.Root key={f.key}>
                          <Field.Label>{f.label}</Field.Label>
                          {f.multiline ? (
                            <Textarea
                              value={(slide[f.key] as string) ?? ""}
                              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setField(idx, f.key, e.target.value)}
                            />
                          ) : (
                            <TextInput
                              value={(slide[f.key] as string) ?? ""}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField(idx, f.key, e.target.value)}
                            />
                          )}
                        </Field.Root>
                      ))}
                      {items
                        ? items.map((it, itemIdx) => (
                            <Field.Root key={`item-${itemIdx}`}>
                              <Field.Label>Punto {itemIdx + 1}</Field.Label>
                              <TextInput
                                value={it}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItem(idx, itemIdx, e.target.value)}
                              />
                            </Field.Root>
                          ))
                        : null}
                    </Flex>
                  </Box>
                </Flex>
                {idx < slides.length - 1 ? (
                  <Box marginTop={4}>
                    <Hairline />
                  </Box>
                ) : null}
              </Box>
            );
          })}

          {isCarousel ? (
            <>
              <Hairline />
              <Field.Root hint="Caption para el feed de Instagram (con hashtags).">
                <Field.Label>Caption</Field.Label>
                <Textarea
                  value={caption}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCaption(e.target.value)}
                />
                <Field.Hint />
              </Field.Root>
            </>
          ) : null}

          <Hairline />

          <Box background="neutral100" hasRadius padding={3}>
            <Typography variant="pi" textColor="neutral600">
              <b>Descargar placas</b>: baja las imágenes en alta resolución a tu compu (y copia el caption) — listo para subir a Instagram a mano.
              {"  ·  "}
              <b>{isCarousel ? "Guardar en la nota" : "Guardar en Medios"}</b>: las sube a la Media Library
              {isCarousel ? " y las adjunta a la nota (campo Social Cards + caption)" : ""}. No postea a Instagram.
            </Typography>
          </Box>

          <Flex justifyContent="flex-end" gap={2} wrap="wrap">
            <Button size="L" startIcon={<Download />} loading={downloading} onClick={download}>
              Descargar placas
            </Button>
            <Button
              size="L"
              variant="secondary"
              startIcon={<Check />}
              loading={saving}
              disabled={isCarousel && !postDocumentId}
              onClick={save}
            >
              {isCarousel ? "Guardar en la nota" : "Guardar en Medios"}
            </Button>
          </Flex>
          {isCarousel && !postDocumentId ? (
            <Typography variant="pi" textColor="neutral500" textAlign="right">
              "Guardar en la nota" necesita una nota elegida en la fuente — pero "Descargar placas" funciona igual.
            </Typography>
          ) : null}
        </Flex>
      </AccentCard>
    </Flex>
  );
}
