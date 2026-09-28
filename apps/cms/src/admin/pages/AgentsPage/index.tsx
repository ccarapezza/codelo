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
import { Plus, Trash, Pencil, Feather, Magic, PlusCircle, Play, Eye } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useNavigate } from "react-router-dom";
import * as verticals from "../../verticals";
import { PageContainer, PageHeader, Hairline } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useLocaleFechas, useT } from "../../i18n";

// CRUD por la API propia y no por la del Content Manager: el content-type está
// oculto ahí a propósito (editar un agente a mano rompe cosas), y esa marca hace
// que /content-manager/collection-types/... devuelva 403 hasta al super admin.
const LIST_API = "/api/agent/admin-list";
const CREATE_API = "/api/agent/admin-create";
const UPDATE_API = "/api/agent/admin-update";
const DELETE_API = "/api/agent/admin-delete";
const RUN_NOW_API = "/api/agent/run-now";

/**
 * Roles que agrega el proyecto (admin/verticals.ts). Se lee a la defensiva,
 * como en Ajustes: un proyecto con una costura anterior a `agentRoles` no la
 * exporta, y un `.map` sobre `undefined` deja la pantalla en blanco. Son sólo
 * datos: las etiquetas vienen como texto literal del proyecto.
 */
const VERTICAL_ROLES: NonNullable<typeof verticals.agentRoles> =
  (verticals as Partial<typeof verticals>).agentRoles ?? [];

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

// Las etiquetas son claves (o nombres técnicos, que `t()` devuelve tal cual):
// se traducen al renderizar, nunca acá.
const QUALITY_OPTIONS = [
  { value: "low",      label: "ag.calidad.baja",  model: "gpt-image-1" },
  { value: "medium",   label: "ag.calidad.media", model: "gpt-image-1" },
  { value: "high",     label: "ag.calidad.alta",  model: "gpt-image-1" },
  { value: "standard", label: "Standard",      model: "dall-e-3"    },
  { value: "hd",       label: "HD",            model: "dall-e-3"    },
] as const;

// ─── Day constants ────────────────────────────────────────────────────────────

// Iniciales de cada día, como CLAVES: "L M X J V S D" en castellano no son las
// del inglés ("M T W T F S S").
const DAYS = [
  { key: "MON", label: "ag.dia.lun" },
  { key: "TUE", label: "ag.dia.mar" },
  { key: "WED", label: "ag.dia.mie" },
  { key: "THU", label: "ag.dia.jue" },
  { key: "FRI", label: "ag.dia.vie" },
  { key: "SAT", label: "ag.dia.sab" },
  { key: "SUN", label: "ag.dia.dom" },
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

// Recibe `t` en vez de llamar a `useT()`: es una función común que se invoca
// dentro de un `.map`, y un hook ahí adentro funcionaba de casualidad.
function formatScheduleSummary(s: ScheduleEntry, t: ReturnType<typeof useT>): string {
  const order: DayKey[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const sorted = [...(s.days ?? [])].sort(
    (a, b) => order.indexOf(a as DayKey) - order.indexOf(b as DayKey),
  );
  const inicial = (d: string) => t(DAYS.find((x) => x.key === d)?.label ?? d);
  const daysStr = sorted.length === 0 ? t("ag.todosLosDias") : sorted.map(inicial).join("");
  const tz = s.timezone || DEFAULT_SCHEDULE_TZ;
  const local = tz !== BROWSER_TZ ? convertTime(s.time, tz, BROWSER_TZ) : null;
  const timeStr = local ? `${s.time} (${local} local)` : s.time;
  return `${daysStr} · ${timeStr} · ${t("ag.nNotas", { n: s.notesCount })}`;
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
  role: string;
  instructions: string;
  topic: string | null;
  requireNewsContext?: boolean;
  enabled: boolean;
  schedules: ScheduleEntry[];
  lastRunAt: string | null;
  imagePromptTemplate: string | null;
  imageSize: string | null;
  imageQuality: string | null;
  defaultTag?: { documentId: string; name: string } | null;
};

type FormData = {
  name: string;
  role: string;
  instructions: string;
  topic: string;
  requireNewsContext: boolean;
  enabled: boolean;
  schedules: ScheduleEntry[];
  imagePromptTemplate: string;
  imageSize: string;
  imageQuality: string;
  /** documentId de la etiqueta, o "" para ninguna. */
  defaultTag: string;
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
  defaultTag: "",
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
    defaultTag: a.defaultTag?.documentId ?? "",
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

/**
 * Botón de selección chico: los días de un horario.
 *
 * Con los tokens del tema y no con hex. Tenía clavado el violeta de Strapi
 * (#4945ff sobre #f0f0ff), que no es la paleta de Nib y no cambia con el modo
 * oscuro: en oscuro quedaba un recuadro lila claro sobre fondo casi negro.
 */
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
    <Box
      tag="button"
      type="button"
      onClick={onClick}
      background={selected ? "primary100" : "neutral0"}
      borderColor={selected ? "primary600" : "neutral200"}
      borderStyle="solid"
      borderWidth={selected ? "2px" : "1px"}
      color={selected ? "primary600" : "neutral600"}
      hasRadius
      style={{
        minWidth: 28,
        height: 28,
        padding: "0 8px",
        fontWeight: selected ? 700 : 400,
        fontSize: 12,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {label}
    </Box>
  );
}

function RecurringScheduleEditor({
  schedules,
  onChange,
}: {
  schedules: ScheduleEntry[];
  onChange: (s: ScheduleEntry[]) => void;
}) {
  const t = useT();
  const loc = useLocaleFechas();
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
        <Typography variant="sigma" textColor="neutral600">{t("ag.horarios.titulo")}</Typography>
        <Button size="S" startIcon={<Plus />} variant="tertiary" onClick={addEntry}>
          {t("ag.horario.agregar")}
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
          <Typography textColor="neutral500" textAlign="center" variant="omega">{t("ag.horarios.vacio")}</Typography>
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
                    <Typography variant="pi" textColor="neutral600">{t("ag.dias")}</Typography>
                    <Flex gap={1} marginTop={1} alignItems="center">
                      <DayChip
                        label={t("ag.dias.todos")}
                        selected={(s.days ?? []).length === 0}
                        onClick={() => toggleAllDays(idx)}
                      />
                      {DAYS.map((d) => (
                        <DayChip
                          key={d.key}
                          label={t(d.label)}
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
                              <Field.Label>{t("ag.horario.hora")}</Field.Label>
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
                              <Field.Label>{t("ag.horario.zona")}</Field.Label>
                              <SingleSelect
                                value={tz}
                                onChange={(v: string | number) =>
                                  update(idx, "timezone", String(v))
                                }
                              >
                                {tzOptions(tz).map((z) => (
                                  <SingleSelectOption key={z} value={z}>
                                    {z === BROWSER_TZ ? t("ag.horario.tuZona", { zona: z }) : z}
                                  </SingleSelectOption>
                                ))}
                              </SingleSelect>
                            </Field.Root>
                          </Box>
                          <Box style={{ width: 150 }}>
                            <Field.Root>
                              <Field.Label>{t("ag.notasPorEjecucion")}</Field.Label>
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
                              aria-label={t("ag.horario.activar")}
                            />
                            <Typography variant="pi" textColor="neutral500">
                              {s.enabled ? t("ag.activo") : t("ag.inactivo")}
                            </Typography>
                          </Flex>
                        </Flex>
                        {local ? (
                          <Typography variant="pi" textColor="primary600">
                            🕑 {t("ag.horario.equivale", { hora: s.time, tz, local, tzLocal: BROWSER_TZ })}
                          </Typography>
                        ) : null}
                      </>
                    );
                  })()}

                  {/* Last run info */}
                  {s.lastRunAt ? (
                    <Typography variant="pi" textColor="neutral400">
                      {t("ag.ultimoRun", { cuando: new Date(s.lastRunAt).toLocaleString(loc) })}
                    </Typography>
                  ) : null}
                </Flex>

                <IconButton
                  label={t("ag.horario.eliminar")}
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
  const t = useT();
  const { get, post, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const isMobile = useIsMobile();
  const [form, setForm] = React.useState<FormData>(EMPTY_FORM);
  const [etiquetas, setEtiquetas] = React.useState<Array<{ documentId: string; name: string }>>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm(initial.agent ? agentToForm(initial.agent) : EMPTY_FORM);
    // Las etiquetas se listan al abrir el modal y no al montar la pantalla: es
    // el único lugar donde se usan.
    get<Array<{ documentId: string; name: string }>>("/api/news-generator/tags")
      .then((r) => setEtiquetas(r.data ?? []))
      .catch(() => setEtiquetas([]));
  }, [initial.agent, open]);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    const isImageGen = form.role === "image-generator";
    if (!form.name.trim()) {
      toggleNotification({ type: "warning", message: t("ag.err.nombre") });
      return;
    }
    if (!isImageGen && !form.instructions.trim()) {
      toggleNotification({ type: "warning", message: t("ag.err.instrucciones") });
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        role: form.role,
        instructions: isImageGen ? null : form.instructions.trim(),
        topic: (form.role === "redactor" || form.role === "explorador") ? form.topic.trim() : null,
        // Sólo el Redactor lee el pool de RSS: para el Explorador este ajuste
        // no significa nada y guardarlo en true sería mentirle al usuario.
        requireNewsContext: form.role === "redactor" ? form.requireNewsContext : false,
        // El generador de imágenes no publica notas: no tiene sección.
        defaultTag: isImageGen ? null : form.defaultTag || null,
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
        await put(`${UPDATE_API}/${initial.agent.documentId}`, body);
      } else {
        await post(CREATE_API, body);
      }

      toggleNotification({
        type: "success",
        message: initial.agent ? "Agente actualizado." : "Agente creado.",
      });
      onSaved();
      onClose();
    } catch {
      toggleNotification({ type: "danger", message: t("ag.err.guardar") });
    } finally {
      setSaving(false);
    }
  };

  const instructionsLabel =
    form.role === "director"
      ? "Instrucciones editoriales del Director"
      : t("ag.tono.titulo");

  const instructionsHint =
    form.role === "director"
      ? t("ag.director.hint")
      : t("ag.redactor.hint");

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      {/*
        Notes on Strapi 5 Modal internals (apps/cms/node_modules/@strapi/design-system):
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
            {initial.agent ? t("ag.editarX", { nombre: initial.agent.name }) : t("ag.nuevo")}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Box
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1fr) minmax(0, 1fr)",
              gap: isMobile ? 20 : 32,
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
                    ? t("ag.rol.director")
                    : form.role === "image-generator"
                    ? t("ag.rol.imagen")
                    : form.role === "explorador"
                    ? t("ag.rol.explorador")
                    : t("ag.rol.redactor")
                }
              >
                <Field.Label>{t("ag.tipo")}</Field.Label>
                <SingleSelect
                  value={form.role}
                  onChange={(val: string | number) =>
                    set("role", String(val) as "director" | "redactor" | "image-generator" | "explorador")
                  }
                >
                  <SingleSelectOption value="redactor" startIcon={<Feather />}>
                    {t("ag.redactor")}
                  </SingleSelectOption>
                  <SingleSelectOption value="director" startIcon={<Magic />}>
                    {t("ag.director")}
                  </SingleSelectOption>
                  <SingleSelectOption value="explorador" startIcon={<Feather />}>
                    {t("ag.explorador")}
                  </SingleSelectOption>
                  {VERTICAL_ROLES.map((r) => (
                    <SingleSelectOption key={r.value} value={r.value} startIcon={<Magic />}>
                      {r.label}
                    </SingleSelectOption>
                  ))}
                  <SingleSelectOption value="image-generator" startIcon={<Magic />}>{t("ag.generadorImagenes")}</SingleSelectOption>
                </SingleSelect>
                <Field.Hint />
              </Field.Root>

              <Field.Root required hint={t("ag.nombre.hint")}>
                <Field.Label>{t("ag.nombre.label")}</Field.Label>
                <TextInput
                  placeholder={t("ag.nombre.placeholder")}
                  value={form.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    set("name", e.target.value)
                  }
                />
                <Field.Hint />
              </Field.Root>

              {(form.role === "redactor" || form.role === "explorador") ? (
                <Field.Root
                  hint={form.role === "explorador" ? t("ag.area.hint") : t("ag.tema.hint")}
                >
                  <Field.Label>
                    {form.role === "explorador" ? t("ag.area.label") : t("ag.tema.label")}
                  </Field.Label>
                  <Textarea
                    rows={4}
                    placeholder={t("ag.tema.placeholder")}
                    value={form.topic}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      set("topic", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              ) : null}

              {form.role !== "image-generator" ? (
                <Field.Root hint={t("ag.etiqueta.hint")}>
                  <Field.Label>{t("ag.etiqueta.label")}</Field.Label>
                  <SingleSelect
                    value={form.defaultTag}
                    onChange={(v: string) => set("defaultTag", String(v ?? ""))}
                  >
                    <SingleSelectOption value="">{t("ag.etiqueta.ninguna")}</SingleSelectOption>
                    {etiquetas.map((e) => (
                      <SingleSelectOption key={e.documentId} value={e.documentId}>
                        {e.name}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                  <Field.Hint />
                </Field.Root>
              ) : null}

              {form.role === "redactor" ? (
                <Box padding={4} background="neutral100" hasRadius>
                  <Flex justifyContent="space-between" alignItems="center" gap={3}>
                    <Box>
                      <Typography variant="omega" fontWeight="semiBold">
                        {t("ag.exigirFuentes")}
                      </Typography>
                      <Box>
                        <Typography variant="pi" textColor="neutral500">
                          {t("ag.exigirFuentes.hint")}
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={form.requireNewsContext}
                      onCheckedChange={(v: boolean) => set("requireNewsContext", v)}
                      aria-label={t("ag.exigirContexto")}
                    />
                  </Flex>
                </Box>
              ) : null}

              {form.role === "image-generator" ? (
                <>
                  <Field.Root required>
                    <Field.Label>{t("ag.tamanoImagen")}</Field.Label>
                    <SingleSelect
                      value={form.imageSize}
                      onChange={(val: string | number) => set("imageSize", String(val))}
                    >
                      <SingleSelectOption value="1024x1024">{t("ag.tamano.cuadrada")}</SingleSelectOption>
                      <SingleSelectOption value="1536x1024">1536×1024 (landscape)</SingleSelectOption>
                      <SingleSelectOption value="1024x1536">1024×1536 (portrait)</SingleSelectOption>
                      <SingleSelectOption value="1792x1024">1792×1024 (wide)</SingleSelectOption>
                      <SingleSelectOption value="1024x1792">1024×1792 (tall)</SingleSelectOption>
                      <SingleSelectOption value="512x512">{t("ag.tamano.512")}</SingleSelectOption>
                    </SingleSelect>
                  </Field.Root>

                  <Field.Root required>
                    <Field.Label>{t("ag.calidad")}</Field.Label>
                    <SingleSelect
                      value={form.imageQuality}
                      onChange={(val: string | number) => set("imageQuality", String(val))}
                    >
                      <SingleSelectOption value="low">{t("ag.calidad.baja")} — gpt-image-1</SingleSelectOption>
                      <SingleSelectOption value="medium">{t("ag.calidad.media")} — gpt-image-1</SingleSelectOption>
                      <SingleSelectOption value="high">{t("ag.calidad.alta")} — gpt-image-1</SingleSelectOption>
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
                      <Typography variant="pi" textColor="neutral600" fontWeight="bold">{t("ag.costoImagen")}</Typography>
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
                              // Tokens del tema: tenía clavado el violeta de Strapi.
                              background={isSelected ? "primary100" : undefined}
                              borderColor={isSelected ? "primary600" : "transparent"}
                              borderStyle="solid"
                              borderWidth="1px"
                              hasRadius
                              style={{ padding: "6px 10px" }}
                            >
                              <Typography variant="pi" textColor={isSelected ? "primary600" : "neutral500"} fontWeight={isSelected ? "bold" : "normal"}>
                                {t(label)}
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
                        <Typography variant="pi" textColor="neutral400">{t("ag.costoImagen.nota")}</Typography>
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
                      {t("ag.agenteActivo")}
                    </Typography>
                    <Box>
                      <Typography variant="pi" textColor="neutral500">{t("ag.habilitado.hint")}</Typography>
                    </Box>
                  </Box>
                  <Switch
                    checked={form.enabled}
                    onCheckedChange={(v: boolean) => set("enabled", v)}
                    aria-label={t("ag.activarAgente")}
                  />
                </Flex>
              </Box>
            </Flex>

            {/* RIGHT COLUMN — prompt textarea + (optional) schedules */}
            <Flex direction="column" alignItems="stretch" gap={4} style={{ minWidth: 0 }}>
              {form.role === "image-generator" ? (
                <Field.Root hint={t("ag.estiloVisual.hint")}>
                  <Field.Label>{t("ag.estiloVisual.label")}</Field.Label>
                  <Textarea
                    rows={18}
                    placeholder={t("ag.estiloVisual.placeholder")}
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
                      rows={(form.role === "redactor" || form.role === "explorador") ? 10 : 14}
                      placeholder={
                        form.role === "director"
                          ? t("ag.director.placeholder")
                          : t("ag.redactor.placeholder")
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
            <Button variant="tertiary">{t("comun.cancelar")}</Button>
          </Modal.Close>
          <Button onClick={handleSave} loading={saving}>
            {initial.agent ? t("nota.guardarCambios") : t("ag.crearAgente")}
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
  onToggleEnabled,
  toggling,
}: {
  agent: Agent;
  onEdit: () => void;
  onDelete: () => void;
  onRunNow: () => void;
  onToggleEnabled: (next: boolean) => void;
  toggling: boolean;
}) {
  const t = useT();
  const loc = useLocaleFechas();
  const activeSchedules = (agent.schedules ?? []).filter((s) => s.enabled);
  const isMobile = useIsMobile();

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
      {/* En mobile apila: contenido arriba y una barra de acciones abajo (switch
          a la izquierda, iconos a la derecha). En fila quedaba todo apretado. */}
      <Flex
        direction={isMobile ? "column" : "row"}
        justifyContent="space-between"
        alignItems={isMobile ? "stretch" : "flex-start"}
        gap={2}
      >
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Flex gap={2} alignItems="center" marginBottom={1} style={{ flexWrap: "wrap" }}>
            <Typography
              variant="omega"
              fontWeight="bold"
              textColor={agent.enabled ? "neutral800" : "neutral500"}
            >
              {agent.name}
            </Typography>
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
                {t("ag.temaLabel")} {agent.topic.slice(0, 60)}{agent.topic.length > 60 ? "…" : ""}
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
                {agent.imagePromptTemplate ? t("ag.promptPropio") : t("ag.promptDefecto")}
              </Typography>
            </Flex>
          ) : (
            <Box marginTop={2}>
              {activeSchedules.length > 0 ? (
                <Flex direction="column" gap={1}>
                  {activeSchedules.map((s, i) => (
                    <Typography key={i} variant="pi" textColor="neutral500">
                      🕐 {formatScheduleSummary(s, t)}
                    </Typography>
                  ))}
                </Flex>
              ) : (
                <Typography variant="pi" textColor="neutral400">{t("ag.sinHorarios")}</Typography>
              )}
              {agent.lastRunAt ? (
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="neutral400">
                    {t("ag.ultimoRun", { cuando: new Date(agent.lastRunAt).toLocaleString(loc) })}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          )}
        </Box>

        <Flex
          gap={2}
          alignItems="center"
          style={{ flexShrink: 0 }}
          justifyContent={isMobile ? "space-between" : "flex-end"}
          marginTop={isMobile ? 3 : 0}
        >
          {/* Toggle de activación in situ: el switch guarda solo. La etiqueta
              acompaña el estado para que no dependa únicamente de la posición. */}
          <Flex gap={1} alignItems="center">
            <Typography
              variant="pi"
              textColor={agent.enabled ? "success600" : "neutral500"}
            >
              {agent.enabled ? t("ag.activo") : t("ag.inactivo")}
            </Typography>
            <Switch
              checked={agent.enabled}
              onCheckedChange={(v: boolean) => onToggleEnabled(v)}
              disabled={toggling}
              aria-label={agent.enabled ? t("ag.desactivarX", { nombre: agent.name }) : t("ag.activarX", { nombre: agent.name })}
            />
          </Flex>
          {agent.role !== "image-generator" ? (
            <IconButton label={t("ag.ejecutarAhora")} variant="ghost" onClick={onRunNow}>
              <Play />
            </IconButton>
          ) : null}
          <IconButton label={t("comun.editar")} variant="ghost" onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton label={t("comun.eliminar")} variant="ghost" onClick={onDelete}>
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
  countLabel,
  canCreate,
  onCreate,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "primary" | "warning" | "success" | "secondary";
  countLabel: string;
  canCreate: boolean;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
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
                  {countLabel}
                </Typography>
              </Box>
            </Box>
          </Flex>
          {canCreate ? (
            <IconButton label={t("ag.crear", { que: title })} variant="tertiary" onClick={onCreate}>
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
  const t = useT();
  const { get, post, put, del } = useFetchClient();
  const { toggleNotification } = useNotification();
  const navigate = useNavigate();

  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Agent | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Agent | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  // documentId del agente cuyo toggle está en vuelo (deshabilita ese switch).
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  // Run-now state
  const [runNowTarget, setRunNowTarget] = React.useState<Agent | null>(null);
  const [runNowCount, setRunNowCount] = React.useState<number>(1);
  const [running, setRunning] = React.useState(false);
  const [backfilling, setBackfilling] = React.useState(false);

  const loadAgents = React.useCallback(async () => {
    setLoading(true);
    try {
      // El orden y el populate de schedules ahora los fija el endpoint.
      const { data } = await get<{ results: Agent[] }>(LIST_API);
      setAgents(data.results ?? []);
    } catch {
      toggleNotification({ type: "danger", message: t("ag.err.cargar") });
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
      await del(`${DELETE_API}/${deleteTarget.documentId}`);
      toggleNotification({ type: "success", message: t("ag.ok.eliminado") });
      setDeleteTarget(null);
      loadAgents();
    } catch {
      toggleNotification({ type: "danger", message: t("ag.err.eliminar") });
    } finally {
      setDeleting(false);
    }
  };

  // Toggle de activación directo desde el card, sin abrir el modal. Antes,
  // activar un agente exigía abrir el editor, mover el switch y apretar "Guardar
  // cambios" (que además re-valida nombre + instrucciones y re-graba todo el
  // formulario): si el usuario movía el switch pero no guardaba, no pasaba nada
  // —de ahí el "a veces parece que sí"—. Acá el switch ES la acción.
  //
  // Optimista: el card refleja el cambio al instante y sólo se revierte si el
  // PUT falla. Manda sólo { enabled }; el resto del agente (schedules, tema,
  // instrucciones) queda intacto porque el controlador actualiza campo a campo.
  const handleToggleEnabled = async (agent: Agent, next: boolean) => {
    setTogglingId(agent.documentId);
    setAgents((prev) =>
      prev.map((a) => (a.documentId === agent.documentId ? { ...a, enabled: next } : a)),
    );
    try {
      await put(`${UPDATE_API}/${agent.documentId}`, { enabled: next });
    } catch {
      setAgents((prev) =>
        prev.map((a) => (a.documentId === agent.documentId ? { ...a, enabled: !next } : a)),
      );
      toggleNotification({
        type: "danger",
        message: next
          ? t("ag.err.activar", { nombre: agent.name })
          : t("ag.err.desactivar", { nombre: agent.name }),
      });
    } finally {
      setTogglingId(null);
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
        message: t("ag.ok.ejecutado", { nombre: runNowTarget.name, n: runNowCount }),
      });
      setRunNowTarget(null);
      loadAgents();
    } catch {
      toggleNotification({ type: "danger", message: t("ag.err.ejecutar") });
    } finally {
      setRunning(false);
    }
  };

  const director = agents.find((a) => a.role === "director") ?? null;
  const imageGenerator = agents.find((a) => a.role === "image-generator") ?? null;
  const redactors = agents.filter((a) => a.role === "redactor");
  const exploradores = agents.filter((a) => a.role === "explorador");

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
            : t("ag.trad.alDia"),
      });
    } catch {
      toggleNotification({
        type: "danger",
        message: t("ag.err.traducir"),
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
        title={t("ag.titulo")}
        subtitle={t("ag.subtitulo")}
        actions={
          <Flex gap={2}>
            {/* Audit ya no está en el menú lateral; este es su único acceso visible. */}
            <Button variant="tertiary" startIcon={<Eye />} onClick={() => navigate("/audit")}>
              {t("ag.audit")}
            </Button>
            <Button
              variant="secondary"
              loading={backfilling}
              onClick={handleBackfillTranslations}
            >
              {t("ag.traducirFaltantes")}
            </Button>
            <Button startIcon={<PlusCircle />} onClick={openCreate}>{t("ag.nuevo")}</Button>
          </Flex>
        }
      />

      {loading ? (
        <Flex justifyContent="center" padding={10}>
          <Loader>{t("ag.cargando")}</Loader>
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
            title={t("ag.director")}
            description={t("ag.director.desc")}
            accent="primary"
            countLabel={t("ag.de1Configurado", { n: director ? 1 : 0 })}
            canCreate={!director}
            onCreate={openCreate}
          >
            {director ? (
              <AgentItem
                agent={director}
                onEdit={() => openEdit(director)}
                onDelete={() => setDeleteTarget(director)}
                onRunNow={() => openRunNow(director)}
                onToggleEnabled={(next) => handleToggleEnabled(director, next)}
                toggling={togglingId === director.documentId}
              />
            ) : (
              <EmptySectionState
                icon={<Magic aria-hidden />}
                message={t("ag.director.vacio")}
                actionLabel={t("ag.crear", { que: t("ag.director") })}
                onAction={openCreate}
              />
            )}
          </RoleSection>

          {/* Image Generator */}
          <RoleSection
            icon={<Magic aria-hidden />}
            title={t("ag.generadorImagenes")}
            description={t("ag.imagen.desc")}
            accent="warning"
            countLabel={t("ag.de1Configurado", { n: imageGenerator ? 1 : 0 })}
            canCreate={!imageGenerator}
            onCreate={openCreate}
          >
            {imageGenerator ? (
              <AgentItem
                agent={imageGenerator}
                onEdit={() => openEdit(imageGenerator)}
                onDelete={() => setDeleteTarget(imageGenerator)}
                onRunNow={() => {}}
                onToggleEnabled={(next) => handleToggleEnabled(imageGenerator, next)}
                toggling={togglingId === imageGenerator.documentId}
              />
            ) : (
              <EmptySectionState
                icon={<Magic aria-hidden />}
                message={t("ag.imagen.vacio")}
                actionLabel={t("ag.crear", { que: t("ag.generadorImagenes") })}
                onAction={openCreate}
              />
            )}
          </RoleSection>

          {/* Redactors */}
          <RoleSection
            icon={<Feather aria-hidden />}
            title={t("ag.redactores")}
            description={t("ag.redactores.desc")}
            accent="success"
            countLabel={t("ag.redactoresConfigurados", { n: redactors.length })}
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
                    onToggleEnabled={(next) => handleToggleEnabled(a, next)}
                    toggling={togglingId === a.documentId}
                  />
                ))}
              </Flex>
            ) : (
              <EmptySectionState
                icon={<Feather aria-hidden />}
                message={t("ag.redactores.vacio")}
                actionLabel={t("ag.crear", { que: t("ag.redactor") })}
                onAction={openCreate}
              />
            )}
          </RoleSection>

          {/* Exploradores */}
          <RoleSection
            icon={<Feather aria-hidden />}
            title={t("ag.exploradores")}
            description={t("ag.exploradores.desc")}
            accent="secondary"
            countLabel={t("ag.redactoresConfigurados", { n: exploradores.length })}
            canCreate
            onCreate={openCreate}
          >
            {exploradores.length > 0 ? (
              <Flex direction="column" alignItems="stretch" gap={3}>
                {exploradores.map((a) => (
                  <AgentItem
                    key={a.documentId}
                    agent={a}
                    onEdit={() => openEdit(a)}
                    onDelete={() => setDeleteTarget(a)}
                    onRunNow={() => openRunNow(a)}
                    onToggleEnabled={(next) => handleToggleEnabled(a, next)}
                    toggling={togglingId === a.documentId}
                  />
                ))}
              </Flex>
            ) : (
              <EmptySectionState
                icon={<Feather aria-hidden />}
                message={t("ag.exploradores.vacio")}
                actionLabel={t("ag.crear", { que: t("ag.explorador") })}
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
          <Dialog.Header>{t("ag.eliminar.titulo")}</Dialog.Header>
          <Dialog.Body>
            <Typography textAlign="center">
              {t("ag.eliminar.pregunta")}{" "}
              <Typography fontWeight="bold">{deleteTarget?.name}</Typography>
              {t("ag.eliminar.irreversible")}
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">{t("comun.cancelar")}</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger-light" onClick={handleDelete} loading={deleting}>{t("comun.eliminar")}</Button>
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
            {t("ag.ejecutarAhora.titulo", { nombre: runNowTarget?.name ?? "" })}
          </Dialog.Header>
          <Dialog.Body>
            <Flex direction="column" gap={4} padding={2}>
              <Typography textAlign="center" textColor="neutral600">
                {runNowTarget?.role === "redactor"
                  ? t("ag.cuantasNotas")
                  : t("ag.cuantosBorradores")}
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
              <Button variant="tertiary">{t("comun.cancelar")}</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button
                startIcon={<Play />}
                onClick={handleRunNow}
                loading={running}
              >
                {t("ag.ejecutar")}
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </PageContainer>
  );
}
