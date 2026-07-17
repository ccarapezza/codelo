import * as React from "react";
import { Box, Button, Field, Flex, TextInput, Typography } from "@strapi/design-system";
import { ArrowClockwise, Check, Download } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { AccentCard, GroupLabel } from "../../components/ui";
import { OVERLAY_FIELDS, type ReelResult } from "./types";

// Preview + edición del reel. "Recomponer" reusa el clip ya generado
// (clipFileId) → $0 de IA, solo overlay satori + ffmpeg de vuelta.
export default function ReelEditor({
  jobId,
  result,
  onRecompose,
  onSaved,
}: {
  jobId: string;
  result: ReelResult;
  onRecompose: (overlay: { type: ReelResult["overlay"]["type"]; fields: Record<string, string> }, clipFileId: number) => void;
  onSaved: (url: string | null) => void;
}) {
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [fields, setFields] = React.useState<Record<string, string>>(result.overlay.fields);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  // El preview se sirve desde el tmp del job (no está en Medios todavía).
  // El endpoint usa el UUID del job como capability URL, así el <video> puede
  // apuntar directo sin header de auth.
  const videoUrl = `/api/social-studio/jobs/${jobId}/video`;

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await post("/api/social-studio/save", { format: "reel", jobId });
      toggleNotification({ type: "success", message: "Reel guardado en Medios." });
      onSaved((data as { url: string | null }).url ?? null);
    } catch (err) {
      toggleNotification({
        type: "danger",
        message: (err as Error).message || "Error al guardar el reel. Probá recomponerlo (es gratis).",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccentCard
      title={`Reel — ${result.seconds}s · 1080×1920`}
      description="Editá los textos del overlay y recomponé: reusa el clip ya generado, así que no vuelve a gastar IA (solo ffmpeg)."
      accent="success"
      actions={
        <Button
          variant="secondary"
          startIcon={<ArrowClockwise />}
          disabled={!dirty}
          onClick={() => onRecompose({ type: result.overlay.type, fields }, result.clipFileId)}
        >
          Recomponer (gratis)
        </Button>
      }
    >
      <Flex gap={5} alignItems="flex-start" wrap="wrap">
        <Box style={{ width: 240, flexShrink: 0 }}>
          {videoUrl ? (
            <video
              src={videoUrl}
              controls
              loop
              style={{ width: "100%", borderRadius: 8, display: "block", aspectRatio: "9/16", background: "#000" }}
            />
          ) : (
            <Box background="neutral150" hasRadius style={{ width: "100%", aspectRatio: "9/16" }} />
          )}
        </Box>
        <Box style={{ flex: 1, minWidth: 260 }}>
          <GroupLabel>Overlay · {result.overlay.type === "countdown" ? "Countdown" : "Título"}</GroupLabel>
          <Flex direction="column" alignItems="stretch" gap={3} marginTop={2}>
            {OVERLAY_FIELDS[result.overlay.type].map((f) => (
              <Field.Root key={f.key}>
                <Field.Label>{f.label}</Field.Label>
                <TextInput
                  placeholder={f.placeholder}
                  value={fields[f.key] ?? ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFields((prev) => ({ ...prev, [f.key]: e.target.value }));
                    setDirty(true);
                  }}
                />
              </Field.Root>
            ))}
            <Typography variant="pi" textColor="neutral500">
              El clip quedó guardado en la carpeta AI Backgrounds — recomponer o regenerar overlays no vuelve a pagar IA.
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
