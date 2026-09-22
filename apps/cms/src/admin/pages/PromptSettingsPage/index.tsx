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
  SingleSelect,
  SingleSelectOption,
  Typography,
} from "@strapi/design-system";
import { ArrowClockwise, Command, Feather } from "@strapi/icons";
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
const TRADUCIR_API = "/api/prompt-setting/translate-field";
const TRADUCIR_INVERSA_API = "/api/prompt-setting/translate-back";

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
  borrador,
  modo,
  traduciendo,
  onChange,
  onBorrador,
  onTraducir,
}: {
  campo: PromptField;
  valor: string;
  borrador: string;
  modo: "final" | "borrador";
  traduciendo: boolean;
  onChange: (v: string) => void;
  onBorrador: (v: string) => void;
  onTraducir: () => void;
}) {
  const lang = campo.lang ?? "prompt";
  // El modo borrador sólo tiene sentido en los campos de instrucción: los de
  // texto literal ya van en el idioma del sitio, y los fijos no son texto.
  const enBorrador = modo === "borrador" && lang === "prompt";
  const mostrado = enBorrador ? borrador : valor;

  // Si lo guardado no está en la lista —un proyecto que puso un idioma a mano
  // antes de que esto fuera un select—, se agrega como opción en vez de
  // mostrarse vacío y perderse en el primer guardado.
  const opciones = React.useMemo(() => {
    if (!campo.options) return [];
    const v = (valor ?? "").trim();
    return v && !campo.options.some((o) => o.value === v)
      ? [...campo.options, { value: v, label: `${v} (configurado a mano)` }]
      : campo.options;
  }, [campo.options, valor]);

  return (
    <Field.Root hint={campo.hint}>
      <Flex gap={2} alignItems="center" justifyContent="space-between">
        <Field.Label>{campo.label}</Field.Label>
        <Badge backgroundColor={INSIGNIA[lang].fondo} textColor={INSIGNIA[lang].color}>
          {enBorrador ? "borrador" : INSIGNIA[lang].texto}
        </Badge>
      </Flex>
      {campo.options ? (
        <SingleSelect
          value={mostrado}
          onChange={(v: string | number) => onChange(String(v))}
        >
          {opciones.map((o) => (
            <SingleSelectOption key={o.value} value={o.value}>
              {o.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      ) : campo.rows ? (
        <Textarea
          rows={campo.rows}
          value={mostrado}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            enBorrador ? onBorrador(e.target.value) : onChange(e.target.value)
          }
        />
      ) : (
        <TextInput
          value={mostrado}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            enBorrador ? onBorrador(e.target.value) : onChange(e.target.value)
          }
        />
      )}
      <Field.Hint />
      {enBorrador ? (
        <Box paddingTop={2}>
          <Button
            size="S"
            variant="secondary"
            startIcon={<Command />}
            loading={traduciendo}
            disabled={!borrador.trim() || traduciendo}
            onClick={onTraducir}
          >
            Traducir al inglés
          </Button>
          <Box paddingTop={2}>
            <Typography variant="pi" textColor="neutral600">
              Se traduce y te lo mostramos para que lo revises: lo que se le manda al modelo es
              el texto final, no este borrador.
            </Typography>
          </Box>
        </Box>
      ) : null}
      {campo.reference ? <ReferenceNote>{campo.reference}</ReferenceNote> : null}
    </Field.Root>
  );
}

function PromptSettingsPage() {
  const { get, put, post } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [form, setForm] = React.useState<Valores>(VACIO);
  const [saved, setSaved] = React.useState<Valores>(VACIO);
  const [defaults, setDefaults] = React.useState<Valores>(VACIO);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  /**
   * Modo de escritura. En «español» los campos de instrucción muestran el
   * BORRADOR en el idioma del usuario y hay un botón para traducirlo; lo que se
   * envía al modelo sigue siendo el texto final en inglés, que se puede ver y
   * editar cambiando a «final».
   */
  const [modo, setModo] = React.useState<"final" | "borrador">("final");
  const [borradores, setBorradores] = React.useState<Valores>({});
  const [borradoresGuardados, setBorradoresGuardados] = React.useState<Valores>({});
  /** La versión en castellano de los valores neutros, que sirve el motor. */
  const [borradoresBase, setBorradoresBase] = React.useState<Valores>({});
  const [traduciendo, setTraduciendo] = React.useState<string | null>(null);

  // Dirty = el form se separó de lo último guardado. Maneja la píldora de
  // cambios sin guardar, los botones y el atajo ⌘/Ctrl+S.
  const dirty = React.useMemo(
    () =>
      JSON.stringify(form) !== JSON.stringify(saved) ||
      JSON.stringify(borradores) !== JSON.stringify(borradoresGuardados),
    [form, saved, borradores, borradoresGuardados],
  );

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await get<{
          current: Partial<Valores> & { sourceDrafts?: Valores };
          defaults: Partial<Valores>;
          drafts?: Valores;
        }>(ADMIN_API);
        const d = data.defaults ?? {};
        const c = data.current ?? {};
        const next: Valores = { ...VACIO };
        const base: Valores = { ...VACIO };
        for (const k of FIELD_KEYS) {
          base[k] = d[k] ?? "";
          const guardado = (c[k] ?? "").trim();
          next[k] = guardado.length > 0 ? (c[k] as string) : base[k];
        }
        const dr = data.current?.sourceDrafts ?? {};
        setBorradores(dr);
        setBorradoresGuardados(dr);
        setBorradoresBase(data.drafts ?? {});
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
  const setBorrador = (key: string, value: string) =>
    setBorradores((prev) => ({ ...prev, [key]: value }));

  /**
   * Traduce el borrador y deja el resultado en el campo final, SIN guardar.
   * Cambia a modo final para que se vea qué quedó: el punto de todo esto es que
   * nadie tenga un prompt activo que nunca leyó.
   */
  const traducir = async (key: string) => {
    const texto = (borradores[key] ?? "").trim();
    if (!texto) return;
    setTraduciendo(key);
    try {
      const { data } = await post<{ translated: string }>(TRADUCIR_API, { text: texto });
      set(key, data.translated);
      setModo("final");
      toggleNotification({
        type: "success",
        message: "Traducido. Revisalo antes de guardar.",
      });
    } catch {
      toggleNotification({ type: "danger", message: "No se pudo traducir." });
    } finally {
      setTraduciendo(null);
    }
  };

  const restore = (keys: string[]) =>
    setForm((prev) => {
      const next = { ...prev };
      for (const k of keys) next[k] = defaults[k] ?? "";
      return next;
    });

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await put(ADMIN_API, { ...form, sourceDrafts: borradores });
      setSaved(form);
      setBorradoresGuardados(borradores);
      toggleNotification({ type: "success", message: "Configuración guardada." });
    } catch {
      toggleNotification({ type: "danger", message: "Error al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }, [form, borradores, put, toggleNotification]);

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
          <Flex gap={2} alignItems="center">
            <Box style={{ width: "17rem" }}>
              <SingleSelect
                aria-label="Modo de escritura"
                value={modo}
                onChange={(v: string) => setModo(v === "borrador" ? "borrador" : "final")}
              >
                <SingleSelectOption value="final">Ver el texto final</SingleSelectOption>
                <SingleSelectOption value="borrador">Escribir en mi idioma</SingleSelectOption>
              </SingleSelect>
            </Box>
            <Button
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() => restore(FIELD_KEYS)}
            >
              Restaurar todo
            </Button>
          </Flex>
        }
      />

      {modo === "borrador" ? (
        <Box marginBottom={4} padding={4} background="neutral100" hasRadius>
          <Typography variant="pi" textColor="neutral700">
            Estás viendo un borrador en tu idioma, para leer y editar. Lo que se le manda al
            modelo es el texto final, en inglés: traducí un campo para actualizarlo, o cambiá a
            «Ver el texto final» para revisarlo.
          </Typography>
        </Box>
      ) : null}

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
                    borrador={borradores[campo.key] ?? borradoresBase[campo.key] ?? ""}
                    modo={modo}
                    traduciendo={traduciendo === campo.key}
                    onChange={(v) => set(campo.key, v)}
                    onBorrador={(v) => setBorrador(campo.key, v)}
                    onTraducir={() => traducir(campo.key)}
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
        onDiscard={() => {
          setForm(saved);
          setBorradores(borradoresGuardados);
        }}
      />
    </PageContainer>
  );
}
