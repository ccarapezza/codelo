import * as React from "react";
import {
  Box,
  Button,
  TextInput,
  Textarea,
  Field,
  Typography,
  Flex,
  Loader,
} from "@strapi/design-system";
import { Feather, Pencil, Eye, ArrowClockwise } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, AccentCard, SaveBar } from "../../components/ui";

const ADMIN_API = "/api/prompt-setting/admin-config";

// Mirrors PromptSettings in src/lib/prompt-defaults.ts. The page only edits the
// domain-specific fields; the generic scaffolding around them lives in code and
// is shown read-only as reference snippets so the admin sees where text lands.
type PromptSettings = {
  domainDescription: string;
  writingLanguage: string;
  fabricationProneFacts: string;
  analysisModeFraming: string;
  bodyStructureGuide: string;
  imageSystemInstructions: string;
  imageThemeGuide: string;
  imageAnchorTaxonomy: string;
};

type FieldKey = keyof PromptSettings;

const FIELD_KEYS: FieldKey[] = [
  "domainDescription",
  "writingLanguage",
  "fabricationProneFacts",
  "analysisModeFraming",
  "bodyStructureGuide",
  "imageSystemInstructions",
  "imageThemeGuide",
  "imageAnchorTaxonomy",
];

const EMPTY: PromptSettings = {
  domainDescription: "",
  writingLanguage: "",
  fabricationProneFacts: "",
  analysisModeFraming: "",
  bodyStructureGuide: "",
  imageSystemInstructions: "",
  imageThemeGuide: "",
  imageAnchorTaxonomy: "",
};

// Read-only, dimmed reference of the fixed scaffolding that wraps an editable
// field — so the admin understands exactly where their text gets injected.
function ReferenceNote({ children }: { children: React.ReactNode }) {
  return (
    <Box
      marginTop={2}
      padding={3}
      background="neutral100"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      borderRadius="4px"
      hasRadius
    >
      <Typography variant="pi" textColor="neutral500" fontWeight="bold">
        Texto fijo (no editable)
      </Typography>
      <Box marginTop={1}>
        <Typography variant="pi" textColor="neutral500" style={{ whiteSpace: "pre-wrap" }}>
          {children}
        </Typography>
      </Box>
    </Box>
  );
}

export default function PromptSettingsPage() {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [form, setForm] = React.useState<PromptSettings>(EMPTY);
  const [saved, setSaved] = React.useState<PromptSettings>(EMPTY);
  const [defaults, setDefaults] = React.useState<PromptSettings>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Dirty = the form diverged from the last persisted snapshot. Drives the
  // unsaved-changes pill, the Save/Discard enablement and the ⌘/Ctrl+S guard.
  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await get<{ current: Partial<PromptSettings>; defaults: PromptSettings }>(
          ADMIN_API,
        );
        const d = data.defaults;
        const c = data.current ?? {};
        const next = { ...EMPTY };
        for (const k of FIELD_KEYS) {
          const saved = (c[k] ?? "").trim();
          next[k] = saved.length > 0 ? (c[k] as string) : d[k];
        }
        setDefaults(d);
        setForm(next);
        setSaved(next);
      } catch {
        toggleNotification({ type: "danger", message: "No se pudieron cargar los prompts." });
      } finally {
        setLoading(false);
      }
    })();
  }, [get, toggleNotification]);

  const set = (key: FieldKey, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const restore = (keys: FieldKey[]) =>
    setForm((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = defaults[k];
      return next;
    });

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await put(ADMIN_API, form);
      setSaved(form);
      toggleNotification({ type: "success", message: "Prompts guardados." });
    } catch {
      toggleNotification({ type: "danger", message: "Error al guardar los prompts." });
    } finally {
      setSaving(false);
    }
  }, [form, put, toggleNotification]);

  const handleDiscard = () => setForm(saved);

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="50vh">
        <Loader>Cargando prompts...</Loader>
      </Flex>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Feather width="1.4rem" height="1.4rem" />}
        title="Prompts de IA"
        subtitle="Editá las partes del prompt específicas de este proyecto. La estructura genérica (esquemas de salida, reglas anti-alucinación, seguridad de imagen) queda fija en el código y se muestra como referencia. Si dejás un campo vacío, se usa el valor por defecto. Escribí en inglés los campos marcados, porque se insertan dentro de prompts en inglés."
        actions={
          <Button
            variant="tertiary"
            startIcon={<ArrowClockwise />}
            onClick={() => restore(FIELD_KEYS)}
          >
            Restaurar todo a valores por defecto
          </Button>
        }
      />

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        {/* ── Identidad editorial ─────────────────────────────────────────── */}
        <AccentCard
          icon={<Feather />}
          title="Identidad editorial"
          accent="primary"
          description="Qué cubre el sitio y en qué idioma escribe. Define el rol base del Redactor."
          actions={
            <Button
              size="S"
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() => restore(["domainDescription", "writingLanguage"])}
            >
              Restaurar
            </Button>
          }
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Frase en inglés que completa el rol. Ej: 'a Formula 1 news website'.">
              <Field.Label>Descripción del dominio (inglés)</Field.Label>
              <Textarea
                rows={2}
                value={form.domainDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("domainDescription", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`You are a journalist writing in {idioma} for {descripción del dominio}.`}
              </ReferenceNote>
            </Field.Root>

            <Field.Root hint="Idioma en que se escriben los artículos. Ej: 'Spanish', 'español rioplatense', 'English'.">
              <Field.Label>Idioma de escritura</Field.Label>
              <TextInput
                value={form.writingLanguage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("writingLanguage", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </AccentCard>

        {/* ── Redactor ────────────────────────────────────────────────────── */}
        <AccentCard
          icon={<Pencil />}
          title="Redactor & Director"
          accent="success"
          description="Reglas factuales del dominio. El Redactor y el Director las comparten. Las reglas de título y el self-check son fijas."
          actions={
            <Button
              size="S"
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() =>
                restore(["fabricationProneFacts", "analysisModeFraming", "bodyStructureGuide"])
              }
            >
              Restaurar
            </Button>
          }
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Lista (en inglés) de tipos de hechos que nunca deben inventarse. Ej: 'race results, lap times, penalties, driver transfers'.">
              <Field.Label>Hechos que no inventar (inglés)</Field.Label>
              <Textarea
                rows={3}
                value={form.fabricationProneFacts}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("fabricationProneFacts", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`## STRICT FACTUAL RULES\n- NEVER invent {hechos que no inventar}.\n\n(También en el fact-check del Director: "REJECT if the body contains a SPECIFIC claim about an already-occurred event ({hechos que no inventar})…")`}
              </ReferenceNote>
            </Field.Root>

            <Field.Root hint="Cómo debe enmarcarse el título cuando NO hay noticias verificadas (modo análisis). Mezclá idioma e ejemplos según tu sitio.">
              <Field.Label>Encuadre del modo análisis</Field.Label>
              <Textarea
                rows={3}
                value={form.analysisModeFraming}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("analysisModeFraming", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`## STRICT RULES — no verified news available\n…\n- TITLE: must be {encuadre del modo análisis}`}
              </ReferenceNote>
            </Field.Root>

            <Field.Root hint="Reglas de formato del cuerpo (en inglés): markdown con subtítulos ##, listas, citas en >, negritas. Evita que las notas salgan como párrafos planos.">
              <Field.Label>Formato / estructura del cuerpo (inglés)</Field.Label>
              <Textarea
                rows={10}
                value={form.bodyStructureGuide}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("bodyStructureGuide", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`Se inyecta en el prompt del Redactor antes del esquema JSON, y el cuerpo se pide como "rich GitHub-Flavored Markdown".`}
              </ReferenceNote>
            </Field.Root>
          </Flex>
        </AccentCard>

        {/* ── Imágenes ────────────────────────────────────────────────────── */}
        <AccentCard
          icon={<Eye />}
          title="Portadas (imágenes)"
          accent="warning"
          description="Instrucciones de estilo, taxonomía de escenas y reglas de anchors para generar las portadas. La regla de seguridad (sin caras reales / sin logos) se añade siempre y no es editable."
          actions={
            <Button
              size="S"
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() =>
                restore(["imageSystemInstructions", "imageThemeGuide", "imageAnchorTaxonomy"])
              }
            >
              Restaurar
            </Button>
          }
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Instrucciones de sistema (en inglés) para describir las portadas: qué representan, paletas, elementos de marca prohibidos, regla de camiseta. Un agente Generador de imágenes con 'imagePromptTemplate' propio tiene prioridad sobre esto.">
              <Field.Label>Instrucciones de estilo de imagen (inglés)</Field.Label>
              <Textarea
                rows={12}
                value={form.imageSystemInstructions}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("imageSystemInstructions", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`Siempre añadido al final (no editable): "Hard constraint: NO recognizable real faces (silhouettes/backs/hands OK). End with: No text, no watermarks, no logos."`}
              </ReferenceNote>
            </Field.Root>

            <Field.Root hint="Taxonomía THEME → SCENE CUES (en inglés): categorías de escena y variantes (a/b/c/d) entre las que el modelo elige una por portada.">
              <Field.Label>Guía de escenas / temas (inglés)</Field.Label>
              <Textarea
                rows={12}
                value={form.imageThemeGuide}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("imageThemeGuide", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`Pasos fijos del prompt: "1. Identify the core theme… 2. Choose ONE category from THEME → SCENE CUES, then ONE variant (a/b/c/d)… 5. Output a single dense paragraph."`}
              </ReferenceNote>
            </Field.Root>

            <Field.Root hint="Reglas (en inglés) para extraer los anchors visuales del artículo. Solo las reglas de cada campo son editables; la forma del JSON es fija.">
              <Field.Label>Taxonomía de anchors (inglés)</Field.Label>
              <Textarea
                rows={8}
                value={form.imageAnchorTaxonomy}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  set("imageAnchorTaxonomy", e.target.value)
                }
              />
              <Field.Hint />
              <ReferenceNote>
                {`Forma fija del JSON: { "country": string|null, "teamColors": string|null, "jerseyNumber": number|null, "eventType": string|null, "venue": string|null } — solo las reglas de cada campo son editables.`}
              </ReferenceNote>
            </Field.Root>
          </Flex>
        </AccentCard>
      </Box>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </PageContainer>
  );
}
