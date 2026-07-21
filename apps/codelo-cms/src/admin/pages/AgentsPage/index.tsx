import * as React from "react";
import {
  Box,
  Button,
  Modal,
  TextInput,
  Textarea,
  Field,
  SingleSelect,
  SingleSelectOption,
  Switch,
  IconButton,
  Typography,
  Flex,
  Badge,
  Loader,
  Dialog,
  NumberInput,
} from "@strapi/design-system";
import { Plus, Trash, Pencil, Feather, Magic, PlusCircle, Play } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { PageContainer, PageHeader, Hairline } from "../../components/ui";

const CM_BASE = "/content-manager/collection-types/api::agent.agent";
const RUN_NOW_API = "/api/agent/run-now";

// Estimated prices USD per image
// gpt-image-1: quality = low / medium / high
// dall-e-3:    quality = standard / hd  (1536/1024 sizes map to 1792/1024 automatically)
const IMAGE_PRICING: Record<string, Record<string, string>> = {
  "1024x1024": { low: "$0.011", medium: "$0.042", high: "$0.167", standard: "$0.040", hd: "$0.080" },
  "1536x1024": { low: "$0.016", medium: "$0.063", high: "$0.250", standard: "$0.080 (→1792×1024)", hd: "$0.120 (→1792×1024)" },
  "1024x1536": { low: "$0.016", medium: "$0.063", high: "$0.250", standard: "$0.080 (→1024×1792)", hd: "$0.120 (→1024×1792)" },
  "1792x1024": { low: "N/A",    medium: "N/A",    high: "N/A",    standard: "$0.080", hd: "$0.120" },
  "1024x1792": { low: "N/A",    medium: "N/A",    high: "N/A",    standard: "$0.080", hd: "$0.120" },
  "512x512":   { low: "$0.007", medium: "N/A",    high: "N/A",    standard: "N/A",    hd: "N/A"    },
};

const QUALITY_OPTIONS = [
  { value: "low",      label: "Baja",          model: "gpt-image-1" },
  { value: "medium",   label: "Media",         model: "gpt-image-1" },
  { value: "high",     label: "Alta",          model: "gpt-image-1" },
  { value: "standard", label: "Standard",      model: "dall-e-3"    },
  { value: "hd",       label: "HD",            model: "dall-e-3"    },
] as const;

// ─── Day constants ────────────────────────────────────────────────────────────

const DAYS = [
  { key: "MON", label: "L" },
  { key: "TUE", label: "M" },
  { key: "WED", label: "X" },
  { key: "THU", label: "J" },
  { key: "FRI", label: "V" },
  { key: "SAT", label: "S" },
  { key: "SUN", label: "D" },
] as const;

type DayKey = (typeof DAYS)[number]["key"];

// ─── Timezone helpers ───────────────────────────────────────────────────────────
// Schedules store wall-clock time + the IANA zone they were authored in. The
// container runs in UTC and the runner re-interprets time/days in that zone, so
// here we only deal with display: show each time in its own zone and convert it
// to the viewer's browser zone as a hint.

const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
// Keep in sync with DEFAULT_SCHEDULE_TZ in src/lib/agent-runner.ts (fallback for
// legacy schedules with no timezone stored).
const DEFAULT_SCHEDULE_TZ = "America/Argentina/Buenos_Aires";

const COMMON_TZS = [
  "America/Argentina/Buenos_Aires",
  "America/Sao_Paulo",
  "America/Santiago",
  "America/Mexico_City",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
  "UTC",
];

// Build the zone dropdown: browser zone first, then default, then current value,
// then the common list — deduped, so the stored value is always selectable.
function tzOptions(current: string): string[] {
  const out: string[] = [];
  const add = (t: string) => {
    if (t && !out.includes(t)) out.push(t);
  };
  add(BROWSER_TZ);
  add(DEFAULT_SCHEDULE_TZ);
  add(current);
  COMMON_TZS.forEach(add);
  return out;
}

function tzParts(date: Date, tz: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  let hour = g("hour");
  if (hour === 24) hour = 0; // some ICU builds emit "24" for midnight
  return { year: g("year"), month: g("month"), day: g("day"), hour, minute: g("minute") };
}

// Convert wall-clock "HH:MM" authored in `fromTz` to the equivalent "HH:MM" in
// `toTz`, using today's date as the DST reference. Returns null if time is blank.
function convertTime(time: string, fromTz: string, toTz: string): string | null {
  if (!/^\d{1,2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  const ref = tzParts(new Date(), fromTz); // today's calendar date in fromTz
  // Find the real UTC instant for that wall-clock by correcting the zone offset.
  const naiveUTC = Date.UTC(ref.year, ref.month - 1, ref.day, h, m);
  const seen = tzParts(new Date(naiveUTC), fromTz);
  const seenUTC = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  const realUTC = new Date(naiveUTC - (seenUTC - naiveUTC));
  const out = tzParts(realUTC, toTz);
  return `${String(out.hour).padStart(2, "0")}:${String(out.minute).padStart(2, "0")}`;
}

function formatScheduleSummary(s: ScheduleEntry): string {
  const order: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const sorted = [...(s.days ?? [])].sort(
    (a, b) => order.indexOf(a as DayKey) - order.indexOf(b as DayKey),
  );
  const dayMap: Record<DayKey, string> = {
    MON: "L", TUE: "M", WED: "X", THU: "J", FRI: "V", SAT: "S", SUN: "D",
  };
  const daysStr =
    sorted.length === 0
      ? "Todos los días"
      : sorted.map((d) => dayMap[d as DayKey]).join("");
  const tz = s.timezone || DEFAULT_SCHEDULE_TZ;
  const local = tz !== BROWSER_TZ ? convertTime(s.time, tz, BROWSER_TZ) : null;
  const timeStr = local ? `${s.time} (${local} local)` : s.time;
  return `${daysStr} · ${timeStr} · ${s.notesCount} nota${s.notesCount !== 1 ? "s" : ""}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleEntry = {
  id?: number;
  days: string[];
  time: string;
  timezone: string | null;
  notesCount: number;
  enabled: boolean;
  lastRunAt: string | null;
};

type Agent = {
  id: number;
  documentId: string;
  name: string;
  role: "director" | "redactor" | "image-generator";
  instructions: string;
  topic: string | null;
  requireNewsContext?: boolean;
  enabled: boolean;
  schedules: ScheduleEntry[];
  lastRunAt: string | null;
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
};

type FormData = {
  name: string;
  role: "director" | "redactor" | "image-generator";
  instructions: string;
  topic: string;
  requireNewsContext: boolean;
  enabled: boolean;
  schedules: ScheduleEntry[];
  imagePromptTemplate: string;
  imageSize: string;
  imageQuality: string;
};

const EMPTY_FORM: FormData = {
  name: "",
  role: "redactor",
  instructions: "",
  topic: "",
  requireNewsContext: false,
  enabled: true,
  schedules: [],
  imagePromptTemplate: "",
  imageSize: "1024x1024",
  imageQuality: "low",
};

const EMPTY_SCHEDULE = (): ScheduleEntry => ({
  days: [],
  time: "09:00",
  timezone: BROWSER_TZ, // new schedules default to the editor's current zone
  notesCount: 1,
  enabled: true,
  lastRunAt: null,
});

function agentToForm(a: Agent): FormData {
  return {
    name: a.name,
    role: a.role,
    instructions: a.instructions ?? "",
    topic: a.topic ?? "",
    requireNewsContext: a.requireNewsContext ?? false,
    enabled: a.enabled,
    schedules: a.schedules.map((s) => ({
      id: s.id,
      days: s.days ?? [],
      time: s.time ?? "09:00",
      // Legacy schedules without a stored zone were interpreted as the default.
      timezone: s.timezone ?? DEFAULT_SCHEDULE_TZ,
      notesCount: s.notesCount ?? 1,
      enabled: s.enabled ?? true,
      lastRunAt: s.lastRunAt ?? null,
    })),
    imagePromptTemplate: a.imagePromptTemplate ?? "",
    imageSize: a.imageSize ?? "1024x1024",
    imageQuality: a.imageQuality ?? "low",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DayChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 4,
        border: selected ? "2px solid #4945ff" : "1px solid #dcdce4",
        background: selected ? "#f0f0ff" : "transparent",
        color: selected ? "#4945ff" : "#666687",
        fontWeight: selected ? 700 : 400,
        fontSize: 12,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label}
    </button>
  );
}

function RecurringScheduleEditor({
  schedules,
  onChange,
}: {
  schedules: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
}) {
  const addEntry = () => onChange([...schedules, EMPTY_SCHEDULE()]);
  const removeEntry = (idx: number) => onChange(schedules.filter((_, i) => i !== idx));

  const update = <K extends keyof ScheduleEntry>(
    idx: number,
    key: K,
    value: ScheduleEntry[K],
  ) => onChange(schedules.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));

  const toggleDay = (idx: number, day: string) => {
    const current = schedules[idx].days ?? [];
    const next = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day];
    update(idx, "days", next);
  };

  const toggleAllDays = (idx: number) => {
    const current = schedules[idx].days ?? [];
    update(idx, "days", current.length === 0 ? DAYS.map((d) => d.key) : []);
  };

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" paddingBottom={2}>
        <Typography variant="sigma" textColor="neutral600">
          Horarios de ejecución recurrentes
        </Typography>
        <Button size="S" startIcon={<Plus />} variant="tertiary" onClick={addEntry}>
          Agregar horario
        </Button>
      </Flex>

      {schedules.length === 0 ? (
        <Box
          padding={4}
          background="neutral100"
          borderColor="neutral200"
          borderStyle="dashed"
          borderWidth="1px"
          borderRadius="4px"
          hasRadius
        >
          <Typography textColor="neutral500" textAlign="center" variant="omega">
            Sin horarios configurados. Agregá uno para que el agente se ejecute automáticamente.
          </Typography>
        </Box>
      ) : (
        <Flex direction="column" alignItems="stretch" gap={3}>
          {schedules.map((s, idx) => (
            <Box
              key={idx}
              padding={4}
              background="neutral100"
              borderColor="neutral200"
              borderWidth="1px"
              borderStyle="solid"
              borderRadius="4px"
              hasRadius
            >
              <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
                <Flex direction="column" alignItems="stretch" gap={3} style={{ flex: 1 }}>
                  {/* Days row */}
                  <Box>
                    <Typography variant="pi" textColor="neutral600">
                      Días
                    </Typography>
                    <Flex gap={1} marginTop={1} alignItems="center">
                      <button
                        type="button"
                        onClick={() => toggleAllDays(idx)}
                        style={{
                          height: 28,
                          padding: "0 8px",
                          borderRadius: 4,
                          border:
                            (s.days ?? []).length === 0
                              ? "2px solid #4945ff"
                              : "1px solid #dcdce4",
                          background:
                            (s.days ?? []).length === 0 ? "#f0f0ff" : "transparent",
                          color:
                            (s.days ?? []).length === 0 ? "#4945ff" : "#666687",
                          fontWeight: (s.days ?? []).length === 0 ? 700 : 400,
                          fontSize: 11,
                          cursor: "pointer",
                        }}
                      >
                        Todos
                      </button>
                      {DAYS.map((d) => (
                        <DayChip
                          key={d.key}
                          label={d.label}
                          selected={(s.days ?? []).includes(d.key)}
                          onClick={() => toggleDay(idx, d.key)}
                        />
                      ))}
                    </Flex>
                  </Box>

                  {/* Time + Timezone + Notes row */}
                  {(() => {
                    const tz = s.timezone || DEFAULT_SCHEDULE_TZ;
                    const local =
                      tz !== BROWSER_TZ ? convertTime(s.time, tz, BROWSER_TZ) : null;
                    return (
                      <>
                        <Flex gap={4} alignItems="flex-end">
                          <Box style={{ width: 120 }}>
                            <Field.Root>
                              <Field.Label>Hora</Field.Label>
                              <TextInput
                                type="time"
                                value={s.time}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  update(idx, "time", e.target.value)
                                }
                              />
                            </Field.Root>
                          </Box>
                          <Box style={{ width: 240 }}>
                            <Field.Root>
                              <Field.Label>Zona horaria</Field.Label>
                              <SingleSelect
                                value={tz}
                                onChange={(v: string | number) =>
                                  update(idx, "timezone", String(v))
                                }
                              >
                                {tzOptions(tz).map((z) => (
                                  <SingleSelectOption key={z} value={z}>
                                    {z === BROWSER_TZ ? `${z} (tu zona)` : z}
                                  </SingleSelectOption>
                                ))}
                              </SingleSelect>
                            </Field.Root>
                          </Box>
                          <Box style={{ width: 150 }}>
                            <Field.Root>
                              <Field.Label>Notas por ejecución</Field.Label>
                              <NumberInput
                                value={s.notesCount}
                                onValueChange={(v: number | undefined) =>
                                  update(idx, "notesCount", Math.max(1, Math.min(10, v ?? 1)))
                                }
                                min={1}
                                max={10}
                              />
                            </Field.Root>
                          </Box>
                          <Flex alignItems="center" gap={2} paddingBottom={1}>
                            <Switch
                              checked={s.enabled}
                              onCheckedChange={(v: boolean) => update(idx, "enabled", v)}
                              aria-label="Activar horario"
                            />
                            <Typography variant="pi" textColor="neutral500">
                              {s.enabled ? "Activo" : "Inactivo"}
                            </Typography>
                          </Flex>
                        </Flex>
                        {local ? (
                          <Typography variant="pi" textColor="primary600">
                            🕑 {s.time} en {tz} = {local} en tu hora local ({BROWSER_TZ})
                          </Typography>
                        ) : null}
                      </>
                    );
                  })()}

                  {/* Last run info */}
                  {s.lastRunAt ? (
                    <Typography variant="pi" textColor="neutral400">
                      Último run: {new Date(s.lastRunAt).toLocaleString("es-AR")}
                    </Typography>
                  ) : null}
                </Flex>

                <IconButton
                  label="Eliminar horario"
                  variant="ghost"
                  onClick={() => removeEntry(idx)}
                >
                  <Trash />
                </IconButton>
              </Flex>
            </Box>
          ))}
        </Flex>
      )}
    </Box>
  );
}

// ─── AgentFormModal ───────────────────────────────────────────────────────────

function AgentFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: { agent: Agent | null };
}) {
  const { post, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [form, setForm] = React.useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(initial.agent ? agentToForm(initial.agent) : EMPTY_FORM);
  }, [initial.agent, open]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const isImageGen = form.role === "image-generator";
    if (!form.name.trim()) {
      toggleNotification({ type: "warning", message: "El nombre es obligatorio." });
      return;
    }
    if (!isImageGen && !form.instructions.trim()) {
      toggleNotification({ type: "warning", message: "Las instrucciones son obligatorias." });
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        role: form.role,
        instructions: isImageGen ? null : form.instructions.trim(),
        topic: form.role === "redactor" ? form.topic.trim() : null,
        requireNewsContext: form.role === "redactor" ? form.requireNewsContext : false,
        enabled: form.enabled,
        schedules: isImageGen
          ? []
          : form.schedules.map((s) => ({
              ...(s.id ? { id: s.id } : {}),
              days: s.days,
              time: s.time,
              timezone: s.timezone || DEFAULT_SCHEDULE_TZ,
              notesCount: s.notesCount,
              enabled: s.enabled,
            })),
        imagePromptTemplate: isImageGen ? form.imagePromptTemplate.trim() || null : null,
        imageSize: isImageGen ? form.imageSize || "1024x1024" : null,
        imageQuality: isImageGen ? form.imageQuality || "low" : null,
      };

      if (initial.agent) {
        await put(`${CM_BASE}/${initial.agent.documentId}`, body);
      } else {
        await post(CM_BASE, body);
      }

      toggleNotification({
        type: "success",
        message: initial.agent ? "Agente actualizado." : "Agente creado.",
      });
      onSaved();
      onClose();
    } catch {
      toggleNotification({ type: "danger", message: "Ocurrió un error al guardar." });
    } finally {
      setSaving(false);
    }
  };

  const instructionsLabel =
    form.role === "director"
      ? "Instrucciones editoriales del Director"
      : "Tono y estilo del Redactor";

  const instructionsHint =
    form.role === "director"
      ? "Lineamientos que el Director aplicará al revisar y publicar borradores."
      : "Describí la voz, el estilo y la personalidad del redactor.";

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      {/*
        Notes on Strapi 5 Modal internals (apps/codelo-cms/node_modules/@strapi/design-system):
          - Modal.Content (ContentImpl) is already display:flex, flex-direction:column with max-width: 83rem.
            We widen it via inline style — width wins over the styled-component class because of inline-style specificity.
            We do NOT override max-height: 90vh; letting the modal grow to fit content and cap there prevents the
            ugly empty gap below the body when the form is shorter than the forced height.
          - Modal.Body is a Radix ScrollArea (not a div). Passing overflow/flex via style fights ScrollArea internals
            and produces the horizontal scrollbar we saw in screenshot #1. Leaving it alone is correct.
      */}
      <Modal.Content
        style={{
          width: "92vw",
          maxWidth: "1400px",
        }}
      >
        <Modal.Header>
          <Modal.Title>
            {initial.agent ? `Editar agente: ${initial.agent.name}` : "Nuevo agente"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 32,
            }}
          >
            {/* LEFT COLUMN — 50% width, all fields auto-stretch to fill.
                alignItems="stretch" is REQUIRED: Strapi's Flex defaults to alignItems="center"
                (see @strapi/design-system dist/index.mjs line ~394), which in a column flex
                centers children on the cross axis and renders them content-width — exactly the
                "centered narrow inputs" bug the user flagged. */}
            <Flex direction="column" alignItems="stretch" gap={4} style={{ minWidth: 0 }}>
              <Field.Root
                required
                hint={
                  form.role === "director"
                    ? "El Director revisa los borradores generados por los Redactores y los publica."
                    : form.role === "image-generator"
                    ? "El Generador de imágenes provee configuración para generar portadas con IA."
                    : "El Redactor genera artículos en borrador según su tema y estilo."
                }
              >
                <Field.Label>Tipo de agente</Field.Label>
                <SingleSelect
                  value={form.role}
                  onChange={(val: string | number) =>
                    set("role", String(val) as "director" | "redactor" | "image-generator")
                  }
                >
                  <SingleSelectOption value="redactor" startIcon={<Feather />}>
                    Redactor
                  </SingleSelectOption>
                  <SingleSelectOption value="director" startIcon={<Magic />}>
                    Director
                  </SingleSelectOption>
                  <SingleSelectOption value="image-generator" startIcon={<Magic />}>
                    Generador de imágenes
                  </SingleSelectOption>
                </SingleSelect>
                <Field.Hint />
              </Field.Root>

              <Field.Root required hint="Este nombre aparecerá como Autor en los artículos generados.">
                <Field.Label>Nombre del agente / Autor</Field.Label>
                <TextInput
                  placeholder="Ej: Lucas Pérez"
                  value={form.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    set("name", e.target.value)
                  }
                />
                <Field.Hint />
              </Field.Root>

              {form.role === "redactor" ? (
                <Field.Root hint="Definí el área temática que cubrirá este redactor. Cuanto más específico, mejor.">
                  <Field.Label>Tema del redactor</Field.Label>
                  <Textarea
                    rows={4}
                    placeholder="Palabras clave del beat, separadas por espacios. Ej: cannabis cannábico cáñamo REPROCANN ARICCAME autocultivo"
                    value={form.topic}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      set("topic", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              ) : null}

              {form.role === "redactor" ? (
                <Box padding={4} background="neutral100" hasRadius>
                  <Flex justifyContent="space-between" alignItems="center" gap={3}>
                    <Box>
                      <Typography variant="omega" fontWeight="semiBold">
                        Exigir fuentes
                      </Typography>
                      <Box>
                        <Typography variant="pi" textColor="neutral500">
                          Si no hay noticias que matcheen el tema, no escribe nada. Sin
                          fuentes el modelo redacta de memoria e inventa datos.
                          Recomendado en legales y salud.
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={form.requireNewsContext}
                      onCheckedChange={(v: boolean) => set("requireNewsContext", v)}
                      aria-label="Exigir contexto de noticias"
                    />
                  </Flex>
                </Box>
              ) : null}

              {form.role === "image-generator" ? (
                <>
                  <Field.Root required>
                    <Field.Label>Tamaño de imagen</Field.Label>
                    <SingleSelect
                      value={form.imageSize}
                      onChange={(val: string | number) => set("imageSize", String(val))}
                    >
                      <SingleSelectOption value="1024x1024">1024×1024 (cuadrada)</SingleSelectOption>
                      <SingleSelectOption value="1536x1024">1536×1024 (landscape)</SingleSelectOption>
                      <SingleSelectOption value="1024x1536">1024×1536 (portrait)</SingleSelectOption>
                      <SingleSelectOption value="1792x1024">1792×1024 (wide)</SingleSelectOption>
                      <SingleSelectOption value="1024x1792">1024×1792 (tall)</SingleSelectOption>
                      <SingleSelectOption value="512x512">512×512 (pequeña)</SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>

                  <Field.Root required>
                    <Field.Label>Calidad</Field.Label>
                    <SingleSelect
                      value={form.imageQuality}
                      onChange={(val: string | number) => set("imageQuality", String(val))}
                    >
                      <SingleSelectOption value="low">Baja — gpt-image-1</SingleSelectOption>
                      <SingleSelectOption value="medium">Media — gpt-image-1</SingleSelectOption>
                      <SingleSelectOption value="high">Alta — gpt-image-1</SingleSelectOption>
                      <SingleSelectOption value="standard">Standard — dall-e-3</SingleSelectOption>
                      <SingleSelectOption value="hd">HD — dall-e-3</SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>

                  {IMAGE_PRICING[form.imageSize] ? (
                    <Box
                      padding={3}
                      background="neutral100"
                      borderColor="neutral200"
                      borderWidth="1px"
                      borderStyle="solid"
                      borderRadius="4px"
                      hasRadius
                    >
                      <Typography variant="pi" textColor="neutral600" fontWeight="bold">
                        Costo estimado por imagen
                      </Typography>
                      <Flex gap={2} marginTop={2} style={{ flexWrap: "wrap" }}>
                        {QUALITY_OPTIONS.map(({ value, label, model }) => {
                          const price = IMAGE_PRICING[form.imageSize]?.[value];
                          if (!price) return null;
                          const isSelected = form.imageQuality === value;
                          return (
                            <Flex
                              key={value}
                              direction="column"
                              alignItems="center"
                              gap={1}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 4,
                                background: isSelected ? "#f0f0ff" : "transparent",
                                border: isSelected ? "1px solid #4945ff" : "1px solid transparent",
                              }}
                            >
                              <Typography variant="pi" textColor={isSelected ? "primary600" : "neutral500"} fontWeight={isSelected ? "bold" : "normal"}>
                                {label}
                              </Typography>
                              <Typography variant="pi" textColor="neutral400" style={{ fontSize: 10 }}>
                                {model}
                              </Typography>
                              <Typography variant="omega" textColor={isSelected ? "primary700" : "neutral600"} fontWeight={isSelected ? "bold" : "normal"}>
                                {price}
                              </Typography>
                            </Flex>
                          );
                        })}
                      </Flex>
                      <Box marginTop={2}>
                        <Typography variant="pi" textColor="neutral400">
                          * Precios aprox. en USD. El modelo de imagen se configura en Site Settings. La calidad y estos precios aplican solo a modelos OpenAI; con Nano Banana (Gemini) la calidad se ignora, el tamaño se mapea a aspect ratio y el costo es ~$0.039–0.134 por imagen.
                        </Typography>
                      </Box>
                    </Box>
                  ) : null}
                </>
              ) : null}

              <Box
                padding={4}
                background="neutral100"
                borderColor="neutral200"
                borderWidth="1px"
                borderStyle="solid"
                borderRadius="4px"
                hasRadius
              >
                <Flex justifyContent="space-between" alignItems="center" gap={3}>
                  <Box style={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="omega" fontWeight="bold">
                      Agente activo
                    </Typography>
                    <Box>
                      <Typography variant="pi" textColor="neutral500">
                        Si está desactivado, el cron no lo ejecutará.
                      </Typography>
                    </Box>
                  </Box>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v: boolean) => set("enabled", v)}
                    aria-label="Activar agente"
                  />
                </Flex>
              </Box>
            </Flex>

            {/* RIGHT COLUMN — prompt textarea + (optional) schedules */}
            <Flex direction="column" alignItems="stretch" gap={4} style={{ minWidth: 0 }}>
              {form.role === "image-generator" ? (
                <Field.Root hint="Instrucciones de estilo visual para el modelo de texto que genera el prompt de imagen. Cuanto más específico, más coherentes serán las portadas. Si está vacío se usan las instrucciones por defecto.">
                  <Field.Label>Instrucciones de estilo visual</Field.Label>
                  <Textarea
                    rows={18}
                    placeholder={`Ej: Prefer botanical plate illustrations over photographs for this beat. Warm ochre inks on cream stock, herbarium-sheet layout. No consumption imagery, no people, no faces.`}
                    value={form.imagePromptTemplate}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      set("imagePromptTemplate", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              ) : (
                <>
                  <Field.Root required hint={instructionsHint}>
                    <Field.Label>{instructionsLabel}</Field.Label>
                    <Textarea
                      rows={form.role === "redactor" ? 10 : 14}
                      placeholder={
                        form.role === "director"
                          ? "Ej: Asegurate de que los títulos sean atractivos, el contenido sea preciso y la redacción sea en español rioplatense..."
                          : "Ej: Escribí en primera persona, con un tono apasionado y experto en fútbol argentino..."
                      }
                      value={form.instructions}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        set("instructions", e.target.value)
                      }
                    />
                    <Field.Hint />
                  </Field.Root>

                  <RecurringScheduleEditor
                    schedules={form.schedules}
                    onChange={(s) => set("schedules", s)}
                  />
                </>
              )}
            </Flex>
          </Box>
        </Modal.Body>

        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancelar</Button>
          </Modal.Close>
          <Button onClick={handleSave} loading={saving}>
            {initial.agent ? "Guardar cambios" : "Crear agente"}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

// ─── AgentItem (compact row inside a RoleSection) ─────────────────────────────

function AgentItem({
  agent,
  onEdit,
  onDelete,
  onRunNow,
}: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onRunNow: () => void;
}) {
  const activeSchedules = (agent.schedules ?? []).filter((s) => s.enabled);

  return (
    <Box
      padding={4}
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      borderRadius="4px"
      hasRadius
      shadow="tableShadow"
    >
      <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={2} alignItems="center" marginBottom={1} style={{ flexWrap: "wrap" }}>
            <Typography variant="omega" fontWeight="bold" textColor="neutral800">
              {agent.name}
            </Typography>
            {!agent.enabled ? (
              <Badge textColor="neutral500">Inactivo</Badge>
            ) : null}
          </Flex>

          {agent.instructions ? (
            <Typography
              variant="pi"
              textColor="neutral500"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {agent.instructions}
            </Typography>
          ) : null}

          {agent.role === "redactor" && agent.topic ? (
            <Box marginTop={1}>
              <Typography variant="pi" textColor="primary600">
                Tema: {agent.topic.slice(0, 60)}{agent.topic.length > 60 ? "…" : ""}
              </Typography>
            </Box>
          ) : null}

          {agent.role === "image-generator" ? (
            <Flex gap={2} marginTop={2} style={{ flexWrap: "wrap" }}>
              <Badge backgroundColor="neutral150" textColor="neutral600">
                {agent.imageSize ?? "1024x1024"}
              </Badge>
              <Badge backgroundColor="neutral150" textColor="neutral600">
                {agent.imageQuality ?? "low"}
              </Badge>
              <Typography variant="pi" textColor="neutral400">
                {agent.imagePromptTemplate ? "Prompt personalizado" : "Prompt por defecto"}
              </Typography>
            </Flex>
          ) : (
            <Box marginTop={2}>
              {activeSchedules.length > 0 ? (
                <Flex direction="column" gap={1}>
                  {activeSchedules.map((s, i) => (
                    <Typography key={i} variant="pi" textColor="neutral500">
                      🕐 {formatScheduleSummary(s)}
                    </Typography>
                  ))}
                </Flex>
              ) : (
                <Typography variant="pi" textColor="neutral400">
                  Sin horarios activos
                </Typography>
              )}
              {agent.lastRunAt ? (
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral400">
                    Último run: {new Date(agent.lastRunAt).toLocaleString("es-AR")}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          )}
        </Box>

        <Flex gap={1} style={{ flexShrink: 0 }}>
          {agent.role !== "image-generator" ? (
            <IconButton label="Ejecutar ahora" variant="ghost" onClick={onRunNow}>
              <Play />
            </IconButton>
          ) : null}
          <IconButton label="Editar" variant="ghost" onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton label="Eliminar" variant="ghost" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Flex>
      </Flex>
    </Box>
  );
}

// ─── RoleSection (one column of the dashboard grid) ───────────────────────────

function RoleSection({
  icon,
  title,
  description,
  accent,
  count,
  countLabel,
  canCreate,
  onCreate,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "primary" | "warning" | "success" | "secondary";
  count: number;
  countLabel: string;
  canCreate: boolean;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  const accentBg =
    accent === "primary"
      ? "primary100"
      : accent === "warning"
      ? "warning100"
      : accent === "secondary"
      ? "secondary100"
      : "success100";
  const accentText =
    accent === "primary"
      ? "primary600"
      : accent === "warning"
      ? "warning600"
      : accent === "secondary"
      ? "secondary600"
      : "success600";

  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      borderRadius="4px"
      hasRadius
      shadow="filterShadow"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Header */}
      <Box padding={5}>
        <Flex justifyContent="space-between" alignItems="flex-start" gap={3}>
          <Flex gap={3} alignItems="center">
            <Box
              background={accentBg}
              borderRadius="4px"
              hasRadius
              style={{
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Typography textColor={accentText}>{icon}</Typography>
            </Box>
            <Box>
              <Typography variant="delta" textColor="neutral800">
                {title}
              </Typography>
              <Box>
                <Typography variant="pi" textColor="neutral500">
                  {count} {countLabel}
                </Typography>
              </Box>
            </Box>
          </Flex>
          {canCreate ? (
            <IconButton label={`Crear ${title}`} variant="tertiary" onClick={onCreate}>
              <Plus />
            </IconButton>
          ) : null}
        </Flex>
        <Box marginTop={3}>
          <Typography variant="pi" textColor="neutral600">
            {description}
          </Typography>
        </Box>
      </Box>

      <Hairline />

      {/* Body */}
      <Box
        padding={4}
        background="neutral100"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
      >
        {children}
      </Box>
    </Box>
  );
}

function EmptySectionState({
  icon,
  message,
  actionLabel,
  onAction,
}: {
  icon: React.ReactNode;
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <Flex
      direction="column"
      alignItems="center"
      justifyContent="center"
      gap={3}
      padding={6}
      style={{ flex: 1, textAlign: "center" }}
    >
      <Box
        background="neutral200"
        borderRadius="50%"
        hasRadius
        style={{
          width: 56,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography textColor="neutral500">{icon}</Typography>
      </Box>
      <Typography variant="omega" textColor="neutral600" textAlign="center">
        {message}
      </Typography>
      <Button variant="secondary" startIcon={<Plus />} onClick={onAction}>
        {actionLabel}
      </Button>
    </Flex>
  );
}

// ─── AgentsPage ───────────────────────────────────────────────────────────────

export default function AgentsPage() {
  const { get, post, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Agent | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Run-now state
  const [runNowTarget, setRunNowTarget] = React.useState<Agent | null>(null);
  const [runNowCount, setRunNowCount] = React.useState<number>(1);
  const [running, setRunning] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);

  const loadAgents = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await get<{ results: Agent[] }>(
        `${CM_BASE}?sort[0]=role:asc&sort[1]=name:asc&populate[0]=schedules&pagination[pageSize]=100`,
      );
      setAgents(data.results ?? []);
    } catch {
      toggleNotification({ type: "danger", message: "No se pudieron cargar los agentes." });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification]);

  React.useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await del(`${CM_BASE}/${deleteTarget.documentId}`);
      toggleNotification({ type: "success", message: "Agente eliminado." });
      setDeleteTarget(null);
      loadAgents();
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo eliminar el agente." });
    } finally {
      setDeleting(false);
    }
  };

  const handleRunNow = async () => {
    if (!runNowTarget) return;
    setRunning(true);
    try {
      await post(RUN_NOW_API, {
        documentId: runNowTarget.documentId,
        notesCount: runNowCount,
      });
      toggleNotification({
        type: "success",
        message: `Agente "${runNowTarget.name}" ejecutado con ${runNowCount} nota${runNowCount !== 1 ? "s" : ""}.`,
      });
      setRunNowTarget(null);
      loadAgents();
    } catch {
      toggleNotification({ type: "danger", message: "Error al ejecutar el agente." });
    } finally {
      setRunning(false);
    }
  };

  const director = agents.find((a) => a.role === "director") ?? null;
  const imageGenerator = agents.find((a) => a.role === "image-generator") ?? null;
  const redactors = agents.filter((a) => a.role === "redactor");

  // Backfill English translations for every published Spanish post that lacks
  // one. Fire-and-forget on the server (sequential, respects rate limits);
  // progress lands in the audit trail.
  const handleBackfillTranslations = async () => {
    setBackfilling(true);
    try {
      const { data } = await post<{ ok: boolean; scheduled: number; note?: string }>(
        "/api/post/translate-backfill",
        { limit: 100 },
      );
      toggleNotification({
        type: "success",
        message:
          data.scheduled > 0
            ? `Traduciendo ${data.scheduled} nota${data.scheduled !== 1 ? "s" : ""} al inglés en segundo plano.`
            : "Todas las notas publicadas ya están traducidas.",
      });
    } catch {
      toggleNotification({
        type: "danger",
        message: "No se pudo iniciar la traducción.",
      });
    } finally {
      setBackfilling(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditing(agent);
    setModalOpen(true);
  };

  const openRunNow = (agent: Agent) => {
    setRunNowTarget(agent);
    setRunNowCount(1);
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Magic width="1.4rem" height="1.4rem" />}
        title="AI Agents"
        subtitle="Gestioná los agentes que generan y publican artículos automáticamente."
        actions={
          <Flex gap={2}>
            <Button
              variant="secondary"
              loading={backfilling}
              onClick={handleBackfillTranslations}
            >
              Traducir faltantes
            </Button>
            <Button startIcon={<PlusCircle />} onClick={openCreate}>
              Nuevo agente
            </Button>
          </Flex>
        }
      />

      {loading ? (
        <Flex justifyContent="center" padding={10}>
          <Loader>Cargando agentes...</Loader>
        </Flex>
      ) : (
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 24,
            alignItems: "stretch",
          }}
        >
          {/* Director */}
          <RoleSection
            icon={<Magic aria-hidden />}
            title="Director"
            description="Revisa los borradores generados por los Redactores y publica las notas finales."
            accent="primary"
            count={director ? 1 : 0}
            countLabel="de 1 configurado"
            canCreate={!director}
            onCreate={openCreate}
          >
            {director ? (
              <AgentItem
                agent={director}
                onEdit={() => openEdit(director)}
                onDelete={() => setDeleteTarget(director)}
                onRunNow={() => openRunNow(director)}
              />
            ) : (
              <EmptySectionState
                icon={<Magic aria-hidden />}
                message="Sin Director configurado. Sin él, los borradores no se publicarán automáticamente."
                actionLabel="Crear Director"
                onAction={openCreate}
              />
            )}
          </RoleSection>

          {/* Image Generator */}
          <RoleSection
            icon={<Magic aria-hidden />}
            title="Generador de imágenes"
            description="Provee la configuración para generar portadas con IA. Sin él, las notas se publicarán sin imagen."
            accent="warning"
            count={imageGenerator ? 1 : 0}
            countLabel="de 1 configurado"
            canCreate={!imageGenerator}
            onCreate={openCreate}
          >
            {imageGenerator ? (
              <AgentItem
                agent={imageGenerator}
                onEdit={() => openEdit(imageGenerator)}
                onDelete={() => setDeleteTarget(imageGenerator)}
                onRunNow={() => {}}
              />
            ) : (
              <EmptySectionState
                icon={<Magic aria-hidden />}
                message="Sin Generador de imágenes. El botón de portada del Content Manager quedará deshabilitado."
                actionLabel="Crear Generador"
                onAction={openCreate}
              />
            )}
          </RoleSection>

          {/* Redactors */}
          <RoleSection
            icon={<Feather aria-hidden />}
            title="Redactores"
            description="Cada Redactor genera artículos en borrador sobre su tema específico, con su propio tono y estilo."
            accent="success"
            count={redactors.length}
            countLabel={`Redactor${redactors.length !== 1 ? "es" : ""} configurado${redactors.length !== 1 ? "s" : ""}`}
            canCreate
            onCreate={openCreate}
          >
            {redactors.length > 0 ? (
              <Flex direction="column" alignItems="stretch" gap={3}>
                {redactors.map((a) => (
                  <AgentItem
                    key={a.documentId}
                    agent={a}
                    onEdit={() => openEdit(a)}
                    onDelete={() => setDeleteTarget(a)}
                    onRunNow={() => openRunNow(a)}
                  />
                ))}
              </Flex>
            ) : (
              <EmptySectionState
                icon={<Feather aria-hidden />}
                message="Sin Redactores configurados. Agregá al menos uno para empezar a generar artículos."
                actionLabel="Crear Redactor"
                onAction={openCreate}
              />
            )}
          </RoleSection>

        </Box>
      )}

      {/* Create/Edit modal */}
      <AgentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadAgents}
        initial={{ agent: editing }}
      />

      {/* Delete confirmation */}
      <Dialog.Root
        open={Boolean(deleteTarget)}
        onOpenChange={(v: boolean) => !v && setDeleteTarget(null)}
      >
        <Dialog.Content>
          <Dialog.Header>Eliminar agente</Dialog.Header>
          <Dialog.Body>
            <Typography textAlign="center">
              ¿Estás seguro de que querés eliminar el agente{" "}
              <Typography fontWeight="bold">{deleteTarget?.name}</Typography>?
              Esta acción no se puede deshacer.
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancelar</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger-light" onClick={handleDelete} loading={deleting}>
                Eliminar
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>

      {/* Run Now dialog */}
      <Dialog.Root
        open={Boolean(runNowTarget)}
        onOpenChange={(v: boolean) => !v && setRunNowTarget(null)}
      >
        <Dialog.Content>
          <Dialog.Header>
            Ejecutar ahora: {runNowTarget?.name}
          </Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" gap={4} padding={2}>
              <Typography textAlign="center" textColor="neutral600">
                {runNowTarget?.role === "redactor"
                  ? "¿Cuántas notas generar?"
                  : "¿Cuántos borradores revisar y publicar?"}
              </Typography>
              <Flex justifyContent="center">
                <Box style={{ width: 160 }}>
                  <NumberInput
                    value={runNowCount}
                    onValueChange={(v: number | undefined) =>
                      setRunNowCount(Math.max(1, Math.min(10, v ?? 1)))
                    }
                    min={1}
                    max={10}
                  />
                </Box>
              </Flex>
            </Flex>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancelar</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                startIcon={<Play />}
                onClick={handleRunNow}
                loading={running}
              >
                Ejecutar
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </PageContainer>
  );
}
