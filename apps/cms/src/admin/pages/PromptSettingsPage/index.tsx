import * as React from "react";
import {
  Badge,
  Box,
  Button,
  TextInput,
  Textarea,
  Field,
  Flex,
  Loader,
} from "@strapi/design-system";
import { ArrowClockwise, Feather } from "@strapi/icons";
import { Page, useFetchClient, useNotification } from "@strapi/strapi/admin";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import {
  PageContainer,
  PageHeader,
  AccentCard,
  ReferenceNote,
  SaveBar,
} from "../../components/ui";
import type { FieldLang, PromptCard, PromptField } from "../../seam-types";
import * as verticals from "../../verticals";
import { ENGINE_PROMPT_CARDS } from "./cards";

const ADMIN_API = "/api/prompt-setting/admin-config";

/**
 * Las tarjetas del motor más las del proyecto.
 *
 * La pantalla dejó de tener las tarjetas escritas en el JSX y ahora recorre esta
 * lista: así un proyecto suma las suyas desde su costura en vez de editar un
 * archivo del motor, que es como terminó habiendo una tarjeta de un vertical
 * dentro del panel de todos.
 *
 * Se lee a la defensiva porque un proyecto que todavía no actualizó su costura
 * después del merge no exporta `promptCards`, y el panel no puede romperse.
 */
const CARDS: PromptCard[] = [
  ...ENGINE_PROMPT_CARDS,
  ...((verticals as Partial<typeof verticals>).promptCards ?? []),
];

const FIELDS: PromptField[] = CARDS.flatMap((c) => c.fields);
const FIELD_KEYS: string[] = FIELDS.map((f) => f.key);

type Valores = Record<string, string>;

const VACIO: Valores = Object.fromEntries(FIELD_KEYS.map((k) => [k, ""]));

// Ver el comentario gemelo en SettingsPage: el menu link oculto no bloquea la
// navegación directa a /admin/prompt-settings.
export default function ProtectedPromptSettingsPage() {
  return (
    <Page.Protect permissions={[{ action: ADMIN_PERMISSIONS.promptSettings, subject: null }]}>
      <PromptSettingsPage />
    </Page.Protect>
  );
}

/**
 * La insignia de idioma. Es la respuesta a la pregunta que antes no tenía
 * ninguna: "¿esto lo escribo en inglés o en español?". Los campos de instrucción
 * van en inglés porque todo el andamiaje del motor lo está y los modelos rinden
 * mejor ahí; el idioma de lo que se PUBLICA lo decide «Idioma de escritura».
 */
const INSIGNIA: Record<FieldLang, { texto: string; fondo: string; color: string }> = {
  prompt: { texto: "en inglés", fondo: "primary100", color: "primary700" },
  salida: { texto: "idioma del sitio", fondo: "success100", color: "success700" },
  fijo: { texto: "valor fijo", fondo: "neutral150", color: "neutral700" },
};

function CampoPrompt({
  campo,
  valor,
  onChange,
}: {
  campo: PromptField;
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field.Root hint={campo.hint}>
      <Flex gap={2} alignItems="center" justifyContent="space-between">
        <Field.Label>{campo.label}</Field.Label>
        <Badge
          backgroundColor={INSIGNIA[campo.lang ?? "prompt"].fondo}
          textColor={INSIGNIA[campo.lang ?? "prompt"].color}
        >
          {INSIGNIA[campo.lang ?? "prompt"].texto}
        </Badge>
      </Flex>
      {campo.rows ? (
        <Textarea
          rows={campo.rows}
          value={valor}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
        />
      ) : (
        <TextInput
          value={valor}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      )}
      <Field.Hint />
      {campo.reference ? <ReferenceNote>{campo.reference}</ReferenceNote> : null}
    </Field.Root>
  );
}

function PromptSettingsPage() {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [form, setForm] = React.useState<Valores>(VACIO);
  const [saved, setSaved] = React.useState<Valores>(VACIO);
  const [defaults, setDefaults] = React.useState<Valores>(VACIO);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  // Dirty = el form se separó de lo último guardado. Maneja la píldora de
  // cambios sin guardar, los botones y el atajo ⌘/Ctrl+S.
  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved),
    [form, saved],
  );

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await get<{ current: Partial<Valores>; defaults: Partial<Valores> }>(
          ADMIN_API,
        );
        const d = data.defaults ?? {};
        const c = data.current ?? {};
        const next: Valores = { ...VACIO };
        const base: Valores = { ...VACIO };
        for (const k of FIELD_KEYS) {
          base[k] = d[k] ?? "";
          const guardado = (c[k] ?? "").trim();
          next[k] = guardado.length > 0 ? (c[k] as string) : base[k];
        }
        setDefaults(base);
        setForm(next);
        setSaved(next);
      } catch {
        toggleNotification({ type: "danger", message: "No se pudo cargar la configuración." });
      } finally {
        setLoading(false);
      }
    })();
  }, [get, toggleNotification]);

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const restore = (keys: string[]) =>
    setForm((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = defaults[k] ?? "";
      return next;
    });

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await put(ADMIN_API, form);
      setSaved(form);
      toggleNotification({ type: "success", message: "Configuración guardada." });
    } catch {
      toggleNotification({ type: "danger", message: "Error al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }, [form, put, toggleNotification]);

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="50vh">
        <Loader>Cargando configuración…</Loader>
      </Flex>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Feather width="1.4rem" height="1.4rem" />}
        title="Configuración editorial"
        subtitle="De qué habla este sitio, con qué voz escribe y cómo se ven sus portadas y sus placas: es lo que convierte al motor en ESTE portal, y los agentes lo leen en cada corrida. Cada campo dice en qué idioma va — las instrucciones para el modelo se escriben en inglés, y el idioma de lo que se publica lo decide «Idioma de escritura». Un campo vacío usa el valor por defecto del motor, y «Restaurar» vuelve a ese valor neutro, NO al texto con el que arrancó el proyecto."
        actions={
          <Button
            variant="tertiary"
            startIcon={<ArrowClockwise />}
            onClick={() => restore(FIELD_KEYS)}
          >
            Restaurar todo
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
        {CARDS.map((card) => (
          // El id es el ancla a la que enlaza el checklist de la home.
          <div key={card.id} id={card.id}>
            <AccentCard
              icon={card.icon}
              title={card.title}
              accent={card.accent}
              description={card.description}
              actions={
                <Button
                  size="S"
                  variant="tertiary"
                  startIcon={<ArrowClockwise />}
                  onClick={() => restore(card.fields.map((f) => f.key))}
                >
                  Restaurar
                </Button>
              }
            >
              <Flex direction="column" alignItems="stretch" gap={4}>
                {card.fields.map((campo) => (
                  <CampoPrompt
                    key={campo.key}
                    campo={campo}
                    valor={form[campo.key] ?? ""}
                    onChange={(v) => set(campo.key, v)}
                  />
                ))}
              </Flex>
            </AccentCard>
          </div>
        ))}
      </Box>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => setForm(saved)}
      />
    </PageContainer>
  );
}
