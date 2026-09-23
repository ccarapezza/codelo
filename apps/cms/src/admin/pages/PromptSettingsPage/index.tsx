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
import { useT } from "../../i18n";
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
  prompt: { texto: "prompts.insignia.prompt", fondo: "primary100", color: "primary700" },
  salida: { texto: "prompts.insignia.salida", fondo: "success100", color: "success700" },
  fijo: { texto: "prompts.insignia.fijo", fondo: "neutral150", color: "neutral700" },
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
  const t = useT();
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
      ? [...campo.options, { value: v, label: `${v} ${t("prompts.opcion.manual")}` }]
      : campo.options;
  }, [campo.options, valor]);

  return (
    <Field.Root hint={campo.hint ? t(campo.hint) : undefined}>
      {/* La insignia va PEGADA a la etiqueta, no alineada a la derecha: con la
          tarjeta a ancho completo quedaba a media pantalla de distancia y no se
          leía como parte del campo. */}
      <Flex gap={2} alignItems="center">
        <Field.Label>{t(campo.label)}</Field.Label>
        <Badge backgroundColor={INSIGNIA[lang].fondo} textColor={INSIGNIA[lang].color}>
          {enBorrador ? t("prompts.insignia.borrador") : t(INSIGNIA[lang].texto)}
        </Badge>
      </Flex>
      {campo.options ? (
        <SingleSelect
          value={mostrado}
          onChange={(v: string | number) => onChange(String(v))}
        >
          {opciones.map((o) => (
            <SingleSelectOption key={o.value} value={o.value}>
              {t(o.label)}
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
            {t("prompts.traducir")}
          </Button>
          <Box paddingTop={2}>
            <Typography variant="pi" textColor="neutral600">
              {t("prompts.traducir.nota")}
            </Typography>
          </Box>
        </Box>
      ) : null}
      {campo.reference ? <ReferenceNote>{t(campo.reference)}</ReferenceNote> : null}
    </Field.Root>
  );
}

function PromptSettingsPage() {
  const t = useT();
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
  /**
   * El paso actual. La pantalla es un asistente y no una grilla porque son 21
   * campos: mostrados todos juntos nadie sabe por dónde empezar ni cuándo
   * terminó. Un paso por tarjeta, incluidas las que agregue el proyecto.
   */
  const [paso, setPaso] = React.useState(0);
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

  // El checklist de la home enlaza a /prompt-settings#portadas y similares: el
  // ancla tiene que abrir ese paso, no quedarse en el primero.
  React.useEffect(() => {
    const id = window.location.hash.replace("#", "");
    if (!id) return;
    const i = CARDS.findIndex((c) => c.id === id);
    if (i >= 0) setPaso(i);
  }, []);

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
        toggleNotification({ type: "danger", message: t("prompts.err.cargar") });
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
        message: t("prompts.ok.traducido"),
      });
    } catch {
      toggleNotification({ type: "danger", message: t("prompts.err.traducir") });
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
      toggleNotification({ type: "success", message: t("prompts.ok.guardada") });
    } catch {
      toggleNotification({ type: "danger", message: t("prompts.err.guardar") });
    } finally {
      setSaving(false);
    }
  }, [form, borradores, put, toggleNotification]);

  const actual = CARDS[Math.min(paso, CARDS.length - 1)];

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="50vh">
        <Loader>{t("prompts.cargando")}</Loader>
      </Flex>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        icon={<Feather width="1.4rem" height="1.4rem" />}
        title={t("prompts.titulo")}
        subtitle={t("prompts.subtitulo")}
        actions={
          <Flex gap={2} alignItems="center">
            <Box style={{ width: "17rem" }}>
              <SingleSelect
                aria-label={t("prompts.modo")}
                value={modo}
                onChange={(v: string) => setModo(v === "borrador" ? "borrador" : "final")}
              >
                <SingleSelectOption value="final">{t("prompts.modo.final")}</SingleSelectOption>
                <SingleSelectOption value="borrador">{t("prompts.modo.borrador")}</SingleSelectOption>
              </SingleSelect>
            </Box>
            <Button
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() => restore(FIELD_KEYS)}
            >
              {t("prompts.restaurarTodo")}
            </Button>
          </Flex>
        }
      />

      {modo === "borrador" ? (
        <Box marginBottom={4} padding={4} background="neutral100" hasRadius>
          <Typography variant="pi" textColor="neutral700">
            {t("prompts.borrador.aviso")}
          </Typography>
        </Box>
      ) : null}

      {/* Los pasos, siempre visibles: se puede saltar a cualquiera. Un asistente
          que obliga a pasar por todos en orden es peor que la grilla que
          reemplaza — quien viene a cambiar UNA cosa no quiere un recorrido. */}
      <Flex gap={2} wrap="wrap" marginBottom={5}>
        {CARDS.map((c, i) => (
          <Button
            key={c.id}
            size="S"
            variant={i === paso ? "default" : "tertiary"}
            onClick={() => setPaso(i)}
          >
            {i + 1} · {t(c.title)}
          </Button>
        ))}
      </Flex>

      <div id={actual.id}>
        <AccentCard
          icon={actual.icon}
          title={t("prompts.paso", { n: paso + 1, total: CARDS.length, titulo: t(actual.title) })}
          accent={actual.accent}
          description={t(actual.description)}
          actions={
            <Button
              size="S"
              variant="tertiary"
              startIcon={<ArrowClockwise />}
              onClick={() => restore(actual.fields.map((f) => f.key))}
            >
              {t("prompts.restaurarPaso")}
            </Button>
          }
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            {actual.fields.map((campo) => (
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

      <Flex justifyContent="space-between" alignItems="center" marginTop={4}>
        <Button
          variant="tertiary"
          disabled={paso === 0}
          onClick={() => setPaso((p) => Math.max(0, p - 1))}
        >
          {t("prompts.anterior")}
        </Button>
        <Typography variant="pi" textColor="neutral600">
          {/* Se puede guardar en cualquier paso: los cambios de todos los pasos
              viajan juntos, no hay que llegar al final. */}
          {t("prompts.guardaCuandoQuieras")}
        </Typography>
        <Button
          variant="tertiary"
          disabled={paso === CARDS.length - 1}
          onClick={() => setPaso((p) => Math.min(CARDS.length - 1, p + 1))}
        >
          {t("prompts.siguiente")}
        </Button>
      </Flex>

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
