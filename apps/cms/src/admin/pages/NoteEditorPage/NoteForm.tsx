import * as React from "react";
import {
  Box,
  Button,
  TextInput,
  Textarea,
  Field,
  Flex,
  Typography,
  MultiSelect,
  MultiSelectOption,
  Switch,
} from "@strapi/design-system";
import { Pencil, Images, ArrowClockwise, Upload, Trash } from "@strapi/icons";
import { AccentCard, Hairline } from "../../components/ui";
import { useT } from "../../i18n";

// El estado del form es plano: todo lo editable de una nota vive acá. La página
// contenedora decide si al guardar llama a crear o actualizar.
export type NoteDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: number[];
  featured: boolean;
  cover: { mediaId: number; url: string | null } | null;
  // Prompt de la última portada generada por IA — se persiste para diversidad.
  coverPrompt?: string;
};

export type TagOption = { id: number; name: string; kind: string | null };

// Slug tolerante: minúsculas, sin acentos, espacios→guiones, sin guiones dobles.
// Es un espejo de makeSlug del backend; el server lo normaliza igual al guardar,
// así que esto es sólo para que el usuario vea el resultado en vivo.
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * El formulario compartido de una nota. Es el mismo en los tres flujos: crear a
 * mano (vacío), crear con IA (prellenado por el generador) y editar. Todo lo que
 * cambia entre modos lo maneja la página contenedora; acá sólo vive el form.
 *
 * Refinar con IA y generar/subir imagen viven en el form —no en el flujo IA— a
 * propósito: se pueden usar también cuando escribís a mano.
 */
export function NoteForm({
  draft,
  setDraft,
  tagOptions,
  // slug editado a mano: una vez que el usuario lo toca, deja de autoseguir al título.
  slugTouched,
  onSlugTouched,
  onRefine,
  refining,
  onGenerateImage,
  imageBusy,
  onUpload,
  uploading,
  customImagePrompt,
  setCustomImagePrompt,
}: {
  draft: NoteDraft;
  setDraft: React.Dispatch<React.SetStateAction<NoteDraft>>;
  tagOptions: TagOption[];
  slugTouched: boolean;
  onSlugTouched: () => void;
  onRefine: (instruction: string, web: boolean) => Promise<void>;
  refining: boolean;
  onGenerateImage: () => Promise<void>;
  imageBusy: boolean;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  customImagePrompt: string;
  setCustomImagePrompt: (v: string) => void;
}) {
  const t = useT();
  const [instruction, setInstruction] = React.useState("");
  const [refineWeb, setRefineWeb] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);

  const set = <K extends keyof NoteDraft>(k: K, v: NoteDraft[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  // El slug autosigue al título hasta que el usuario lo edita a mano.
  const onTitle = (v: string) =>
    setDraft(d => ({ ...d, title: v, slug: slugTouched ? d.slug : slugify(v) }));

  return (
    <Flex direction="column" gap={6} alignItems="stretch">
      {/* Contenido */}
      <AccentCard title={t("nota.contenido")} icon={<Pencil />} accent="secondary">
        <Flex direction="column" gap={4} alignItems="stretch">
          <Field.Root>
            <Field.Label>{t("comun.titulo")}</Field.Label>
            <TextInput
              value={draft.title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onTitle(e.target.value)}
            />
          </Field.Root>

          <Field.Root hint={t("nota.slug.hint")}>
            <Field.Label>{t("nota.slug")}</Field.Label>
            <TextInput
              value={draft.slug}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                onSlugTouched();
                set("slug", slugify(e.target.value));
              }}
            />
            <Field.Hint />
          </Field.Root>

          <Field.Root>
            <Field.Label>{t("nota.bajada")}</Field.Label>
            <Textarea
              rows={2}
              value={draft.excerpt}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                set("excerpt", e.target.value)
              }
            />
          </Field.Root>

          <Field.Root hint={t("nota.cuerpo.hint")}>
            <Field.Label>{t("nota.cuerpo")}</Field.Label>
            <Textarea
              rows={16}
              value={draft.content}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                set("content", e.target.value)
              }
            />
            <Field.Hint />
          </Field.Root>

          <Field.Root hint={t("nota.tags.hint")}>
            <Field.Label>{t("nota.etiquetas")}</Field.Label>
            <MultiSelect
              value={draft.tags.map(String)}
              onChange={(vals: string[]) => set("tags", vals.map(Number))}
              placeholder={t("nota.tags.placeholder")}
              withTags
            >
              {/* `tag` y no `t`: con `t` la variable tapaba a la función de traducción. */}
              {tagOptions.map(tag => (
                <MultiSelectOption key={tag.id} value={String(tag.id)}>
                  {tag.name}
                  {tag.kind ? ` · ${tag.kind}` : ""}
                </MultiSelectOption>
              ))}
            </MultiSelect>
            <Field.Hint />
          </Field.Root>
        </Flex>
      </AccentCard>

      {/* Refinar con IA — disponible también en modo manual. */}
      <AccentCard title={t("nota.mejorar")} icon={<ArrowClockwise />} accent="warning">
        <Field.Root hint={t("nota.mejorar.hint")}>
          <Field.Label>{t("nota.instruccion")}</Field.Label>
          <Textarea
            rows={2}
            placeholder={t("nota.instruccion.placeholder")}
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
              aria-label={t("nota.buscar.label")}
            />
            <Typography variant="omega" textColor="neutral700">{t("nota.buscar.hint")}</Typography>
          </Flex>
          <Button
            variant="secondary"
            startIcon={<ArrowClockwise />}
            loading={refining}
            disabled={
              !instruction.trim() || refining || !draft.title.trim() || !draft.content.trim()
            }
            onClick={async () => {
              await onRefine(instruction, refineWeb);
              setInstruction("");
            }}
          >
            {refining ? t("nota.mejorando") : t("nota.aplicarCambio")}
          </Button>
        </Flex>
      </AccentCard>

      {/* Imagen de portada: generar por IA o subir una propia. */}
      <AccentCard title={t("nota.imagen.titulo")} icon={<Images />} accent="success">
        {draft.cover?.url ? (
          <Box marginBottom={4}>
            <img
              src={draft.cover.url}
              alt={t("nota.portada")}
              style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 8, display: "block" }}
            />
            <Box marginTop={2}>
              <Button
                variant="danger-light"
                size="S"
                startIcon={<Trash />}
                onClick={() => set("cover", null)}
              >
                {t("nota.quitarImagen")}
              </Button>
            </Box>
            <Hairline marginY={3} />
          </Box>
        ) : null}

        <Field.Root hint={t("nota.imagen.hint")}>
          <Field.Label>{t("nota.imagen.label")}</Field.Label>
          <Textarea
            rows={2}
            placeholder={t("nota.imagen.placeholder")}
            value={customImagePrompt}
            onChange={e => setCustomImagePrompt(e.target.value)}
            disabled={imageBusy}
          />
          <Field.Hint />
        </Field.Root>

        <Flex gap={2} marginTop={4} wrap="wrap">
          <Button
            variant="secondary"
            startIcon={<Images />}
            loading={imageBusy}
            disabled={imageBusy || uploading || !draft.title.trim()}
            onClick={onGenerateImage}
          >
            {draft.cover ? t("nota.imagen.regenerar") : t("nota.imagen.generar")}
          </Button>
          <Button
            variant="tertiary"
            startIcon={<Upload />}
            loading={uploading}
            disabled={imageBusy || uploading}
            onClick={() => fileRef.current?.click()}
          >{t("nota.imagen.subir")}</Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
              e.target.value = "";
            }}
          />
        </Flex>
      </AccentCard>
    </Flex>
  );
}
