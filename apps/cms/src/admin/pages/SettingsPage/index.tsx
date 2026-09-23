import * as React from "react";
import {
  Box,
  TextInput,
  Field,
  Flex,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Toggle,
  Typography,
} from "@strapi/design-system";
import { ChartPie, Cog, Command, Eye, Key, Magic, PaintBrush } from "@strapi/icons";
import { createGlobalStyle } from "styled-components";
import { PageContainer, PageHeader, AccentCard, Hairline, GroupLabel, SaveBar } from "../../components/ui";

import { Page, useFetchClient, useNotification } from "@strapi/strapi/admin";
import { ADMIN_PERMISSIONS } from "../../../lib/admin-permissions";
import type { SettingCard, SettingField } from "../../seam-types";
import { BRAND_FIELDS, BRAND_KEYS, BrandFields } from "./brand-card";
import * as verticals from "../../verticals";

// Strapi's <SingleSelect> caps its dropdown at max-height: 15.6rem (~6 options),
// which forces scrolling. Mounted only while this page is open, this lets the Radix
// Select popover grow to the available viewport height so every model option shows
// without scrolling. Scoped to Select poppers (not other admin dropdowns/tooltips).
const SelectDropdownHeightFix = createGlobalStyle`
  [data-radix-popper-content-wrapper]:has([data-radix-select-viewport]) > * {
    max-height: var(--radix-select-content-available-height, 32rem) !important;
  }
`;

const ADMIN_API = "/api/site-setting/admin-config";

/**
 * Tarjetas que agrega el proyecto (admin/verticals.ts). Se lee a la defensiva:
 * un proyecto que todavía no actualizó su costura tras el merge no las exporta.
 */
const VERTICAL_CARDS: SettingCard[] = (verticals as Partial<typeof verticals>).settingCards ?? [];
const VERTICAL_KEYS: string[] = VERTICAL_CARDS.flatMap((c) => c.fields.map((f) => f.key));

type Settings = {
  [extra: string]: string | boolean;
  openaiTextModel: string;
  openaiImageModel: string;
  adsensePublisherId: string;
  adsenseSidebarLeftSlot: string;
  adsenseSidebarRightSlot: string;
  adsenseHomeInFeedSlot: string;
  adsenseMobileBannerSlot: string;
  adsenseInArticleSlot: string;
  googleAnalyticsId: string;
  googleSiteVerification: string;
  clarityProjectId: string;
  autoTranslate: boolean;
  houseAdsEnabled: boolean;
  brandBg: string;
  brandTitle: string;
  brandBody: string;
  brandMuted: string;
  brandAccent: string;
  brandAccentLight: string;
  brandAccentDeep: string;
};

const EMPTY: Settings = {
  openaiTextModel: "gpt-4o-mini",
  openaiImageModel: "gpt-image-1-mini",
  adsensePublisherId: "",
  adsenseSidebarLeftSlot: "",
  adsenseSidebarRightSlot: "",
  adsenseHomeInFeedSlot: "",
  adsenseMobileBannerSlot: "",
  adsenseInArticleSlot: "",
  googleAnalyticsId: "",
  googleSiteVerification: "",
  clarityProjectId: "",
  autoTranslate: true,
  houseAdsEnabled: false,
  // Los colores del motor, que son los que el render usa si no se guarda nada.
  // Están duplicados de NEUTRAL_BRAND_COLORS a propósito: importarlo desde acá
  // arrastraría el módulo del renderer al bundle del panel.
  brandBg: "#0E1A1C",
  brandTitle: "#FFFFFF",
  brandBody: "#E6EDEC",
  brandMuted: "#8AA0A1",
  brandAccent: "#2BAFA3",
  brandAccentLight: "#6FE0D4",
  brandAccentDeep: "#1F4E63",
  // Las del proyecto arrancan vacías; el toggle se resuelve al cargar.
  ...Object.fromEntries(VERTICAL_KEYS.map((k) => [k, ""])),
};

// Prices: input / output per 1M tokens (standard tier)
const TEXT_MODELS = [
  { value: "gpt-5.5-pro",   label: "gpt-5.5-pro — $30.00 / $180.00 por 1M tkn" },
  { value: "gpt-5.4-pro",   label: "gpt-5.4-pro — $30.00 / $180.00 por 1M tkn" },
  { value: "o3",             label: "o3 — $10.00 / $40.00 por 1M tkn (razonamiento)" },
  { value: "gpt-5.5",       label: "gpt-5.5 — $5.00 / $30.00 por 1M tkn" },
  { value: "gpt-5.4",       label: "gpt-5.4 — $2.50 / $15.00 por 1M tkn" },
  { value: "gpt-4o",        label: "gpt-4o — $2.50 / $10.00 por 1M tkn" },
  { value: "gpt-4.1",       label: "gpt-4.1 — $2.00 / $8.00 por 1M tkn" },
  { value: "o4-mini",       label: "o4-mini — $1.10 / $4.40 por 1M tkn (razonamiento)" },
  { value: "gpt-5.4-mini",  label: "gpt-5.4-mini — $0.75 / $4.50 por 1M tkn" },
  { value: "gpt-4.1-mini",  label: "gpt-4.1-mini — $0.40 / $1.60 por 1M tkn" },
  { value: "gpt-5.4-nano",  label: "gpt-5.4-nano — $0.20 / $1.25 por 1M tkn" },
  { value: "gpt-4o-mini",   label: "gpt-4o-mini — $0.15 / $0.60 por 1M tkn (recomendado)" },
  { value: "gpt-4.1-nano",  label: "gpt-4.1-nano — $0.10 / $0.40 por 1M tkn" },
];

const IMAGE_MODELS = [
  { value: "gpt-image-2",          label: "gpt-image-2 — $8.00 / $30.00 por 1M tkn" },
  { value: "gpt-image-1.5",        label: "gpt-image-1.5 — $8.00 / $32.00 por 1M tkn" },
  { value: "chatgpt-image-latest", label: "chatgpt-image-latest — alias al modelo más reciente" },
  { value: "gpt-image-1",          label: "gpt-image-1 — ~$5.00 / $15.00 por 1M tkn (recomendado)" },
  { value: "gpt-image-1-mini",     label: "gpt-image-1-mini — $2.50 / $8.00 por 1M tkn" },
  // Google Gemini ("Nano Banana") vía OpenRouter — requiere OPENROUTER_API_KEY. Precio por imagen.
  { value: "google/gemini-3-pro-image-preview",     label: "Nano Banana Pro (gemini-3-pro) — ~$0.134 / imagen" },
  { value: "google/gemini-3.1-flash-image-preview", label: "Nano Banana 2 (gemini-3.1-flash) — ~$0.06–0.15 / imagen" },
  { value: "google/gemini-2.5-flash-image",         label: "Nano Banana (gemini-2.5-flash) — ~$0.039 / imagen" },
];

// Ocultar el link del menú no cierra la puerta: /admin/site-settings sigue
// siendo navegable escribiéndola. Page.Protect es lo que corta ese acceso y
// muestra el cartel de "sin permisos" en vez de un formulario que falla al
// guardar. La API igual valida por su cuenta (requireAdminPermission).
/** Un campo aportado por el proyecto. Los selects de modelo reusan los catálogos del motor. */
function CampoVertical({
  campo,
  valor,
  onChange,
}: {
  campo: SettingField;
  valor: string | boolean;
  onChange: (v: string | boolean) => void;
}) {
  const modelos =
    campo.kind === "text-model" ? TEXT_MODELS : campo.kind === "image-model" ? IMAGE_MODELS : null;
  return (
    <Field.Root hint={campo.hint}>
      <Field.Label>{campo.label}</Field.Label>
      {campo.kind === "toggle" ? (
        <Toggle
          onLabel="Sí"
          offLabel="No"
          checked={Boolean(valor)}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
        />
      ) : modelos ? (
        <SingleSelect value={String(valor ?? "")} onChange={(v: string | number) => onChange(String(v))}>
          <SingleSelectOption value="">(usar el modelo por defecto)</SingleSelectOption>
          {modelos.map((m) => (
            <SingleSelectOption key={m.value} value={m.value}>
              {m.label}
            </SingleSelectOption>
          ))}
        </SingleSelect>
      ) : (
        <TextInput
          placeholder={campo.placeholder}
          value={String(valor ?? "")}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        />
      )}
      <Field.Hint />
    </Field.Root>
  );
}

export default function ProtectedSettingsPage() {
  return (
    <Page.Protect permissions={[{ action: ADMIN_PERMISSIONS.siteSettings, subject: null }]}>
      <SettingsPage />
    </Page.Protect>
  );
}

function SettingsPage() {
  const { get, post, put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [form, setForm] = React.useState<Settings>(EMPTY);
  const [saved, setSaved] = React.useState<Settings>(EMPTY);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  // El logo se sube aparte (multipart) y se guarda con el resto: hasta que no se
  // guarda, `logo.id` es el pendiente y `logo.url` lo que muestra la preview.
  const [logo, setLogo] = React.useState<{ id: number | null; url: string | null }>({ id: null, url: null });
  const [logoGuardado, setLogoGuardado] = React.useState<{ id: number | null; url: string | null }>({ id: null, url: null });
  const [subiendoLogo, setSubiendoLogo] = React.useState(false);
  // Sólo para la vista previa: el @usuario vive en Configuración editorial.
  const [handle, setHandle] = React.useState("");

  // Dirty = the form diverged from the last persisted snapshot. Drives the
  // unsaved-changes pill, the Save/Discard enablement and the ⌘/Ctrl+S guard.
  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(saved) || logo.id !== logoGuardado.id,
    [form, saved, logo.id, logoGuardado.id],
  );

  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await get<Settings>(ADMIN_API);
        const next: Settings = {
          openaiTextModel: data.openaiTextModel ?? "gpt-4o-mini",
          openaiImageModel: data.openaiImageModel ?? "gpt-image-1-mini",
          adsensePublisherId: data.adsensePublisherId ?? "",
          adsenseSidebarLeftSlot: data.adsenseSidebarLeftSlot ?? "",
          adsenseSidebarRightSlot: data.adsenseSidebarRightSlot ?? "",
          adsenseHomeInFeedSlot: data.adsenseHomeInFeedSlot ?? "",
          adsenseMobileBannerSlot: data.adsenseMobileBannerSlot ?? "",
          adsenseInArticleSlot: data.adsenseInArticleSlot ?? "",
          googleAnalyticsId: data.googleAnalyticsId ?? "",
          googleSiteVerification: data.googleSiteVerification ?? "",
          clarityProjectId: data.clarityProjectId ?? "",
          // Sin fila guardada el default es traducir, que es lo que hacía siempre.
          autoTranslate: data.autoTranslate !== false,
          houseAdsEnabled: Boolean(data.houseAdsEnabled),
          ...Object.fromEntries(
            BRAND_FIELDS.map((f) => [f.key, (data[f.key] as string) || EMPTY[f.key]]),
          ),
          ...Object.fromEntries(
            VERTICAL_CARDS.flatMap((c) =>
              c.fields.map((f) => [
                f.key,
                f.kind === "toggle" ? Boolean(data[f.key]) : ((data[f.key] as string) ?? ""),
              ]),
            ),
          ),
        };
        setForm(next);
        setSaved(next);
        const media = (data as { brandLogo?: { id?: number; url?: string } }).brandLogo;
        const cargado = { id: media?.id ?? null, url: media?.url ?? null };
        setLogo(cargado);
        setLogoGuardado(cargado);
      } catch {
        toggleNotification({ type: "danger", message: "No se pudieron cargar las configuraciones." });
      } finally {
        setLoading(false);
      }
    })();
  }, [get, toggleNotification]);

  const set = (key: keyof Settings, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    try {
      await put(ADMIN_API, { ...form, brandLogo: logo.id });
      setSaved(form);
      setLogoGuardado(logo);
      toggleNotification({ type: "success", message: "Configuración guardada." });
    } catch {
      toggleNotification({ type: "danger", message: "Error al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }, [form, logo, put, toggleNotification]);

  const handleDiscard = () => {
    setForm(saved);
    setLogo(logoGuardado);
  };

  // El @usuario vive en Configuración editorial; acá se lee sólo para que la
  // vista previa muestre el pie como va a salir. Si falla, la preview dice
  // "sin firma" y no pasa nada más.
  React.useEffect(() => {
    (async () => {
      try {
        const { data } = await get<{
          current?: Record<string, string>;
          defaults?: Record<string, string>;
        }>("/api/prompt-setting/admin-config");
        // Mismo criterio que el loader del servidor: vacío = el valor por defecto.
        setHandle((data?.current?.socialHandle || data?.defaults?.socialHandle) ?? "");
      } catch {
        setHandle("");
      }
    })();
  }, [get]);

  const subirLogo = React.useCallback(
    async (file: File) => {
      setSubiendoLogo(true);
      try {
        const body = new FormData();
        body.append("file", file);
        const { data } = await post<{ mediaId: number; url: string }>("/api/site-setting/admin-logo", body);
        setLogo({ id: data.mediaId, url: data.url });
        toggleNotification({ type: "success", message: "Logo subido. Guardá para aplicarlo." });
      } catch {
        toggleNotification({ type: "danger", message: "No se pudo subir el logo." });
      } finally {
        setSubiendoLogo(false);
      }
    },
    [post, toggleNotification],
  );

  if (loading) {
    return (
      <Flex justifyContent="center" alignItems="center" minHeight="50vh">
        <Loader>Cargando configuración...</Loader>
      </Flex>
    );
  }

  return (
    <PageContainer>
      <SelectDropdownHeightFix />
      <PageHeader
        icon={<Cog width="1.4rem" height="1.4rem" />}
        title="Site Settings"
        subtitle="Integraciones externas del sitio, la identidad visual de las placas y el consumo de las APIs. Las claves viven en el entorno del CMS, nunca en la base."
      />

      <Box marginBottom={6}>
        <AiUsageCard />
      </Box>

      <Box
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))",
          gap: 24,
          alignItems: "stretch",
        }}
      >
        <AccentCard
          icon={<Magic />}
          title="Modelos de IA"
          accent="primary"
          description="API keys por env var: OPENAI_API_KEY (texto e imágenes), OPENAI_IMAGE_API_KEY (override opcional), OPENROUTER_API_KEY (para imágenes con Nano Banana / Gemini) y OPENAI_ADMIN_KEY (opcional, sólo para ver el consumo acá arriba)."
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Modelo de lenguaje para generación y revisión de artículos.">
              <Field.Label>Modelo de texto</Field.Label>
              <SingleSelect
                value={form.openaiTextModel}
                onChange={(val: string | number) => set("openaiTextModel", String(val))}
              >
                {TEXT_MODELS.map((m) => (
                  <SingleSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
              <Field.Hint />
            </Field.Root>

            <Field.Root hint="Modelo para covers. gpt-image-* / dall-e-3 usan OpenAI; google/gemini-* usan Nano Banana (Gemini) vía OpenRouter y requieren OPENROUTER_API_KEY.">
              <Field.Label>Modelo de imagen</Field.Label>
              <SingleSelect
                value={form.openaiImageModel}
                onChange={(val: string | number) => set("openaiImageModel", String(val))}
              >
                {IMAGE_MODELS.map((m) => (
                  <SingleSelectOption key={m.value} value={m.value}>
                    {m.label}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
              <Field.Hint />
            </Field.Root>
          </Flex>
        </AccentCard>

          <AccentCard
            icon={<Command />}
            title="Publicación"
            accent="secondary"
            description="Qué pasa automáticamente cuando se publica una nota."
          >
            <Flex direction="column" alignItems="stretch" gap={4}>
              <Field.Root hint="Traduce cada nota al publicarla, al idioma configurado en Configuración editorial. En un sitio monolingüe conviene apagarlo: es una llamada al modelo por nota que no se usa.">
                <Field.Label>Traducir automáticamente</Field.Label>
                <Toggle
                  onLabel="Sí"
                  offLabel="No"
                  checked={form.autoTranslate}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    set("autoTranslate", e.target.checked)
                  }
                />
                <Field.Hint />
              </Field.Root>
            </Flex>
          </AccentCard>

        {/*
          Ocupa la fila entera —`1 / -1` y no `span 2`, que en una sola columna
          inventaría una segunda— porque son siete colores más la vista previa:
          en una columna de 380px queda una tira de campos con la placa perdida
          al fondo, justo lo que hay que mirar mientras se elige.
        */}
        <Box style={{ gridColumn: "1 / -1" }}>
        <AccentCard
          icon={<PaintBrush />}
          title="Identidad visual"
          accent="secondary"
          description="Los colores y el logo con los que se dibujan las placas de redes y los overlays de los reels. El texto de las placas —la voz, los hashtags, el @usuario— se configura en Configuración editorial."
        >
          <BrandFields
            valores={Object.fromEntries(BRAND_KEYS.map((k) => [k, String(form[k] ?? "")]))}
            onChange={(k, v) => set(k, v)}
            logoUrl={logo.url}
            handle={handle}
            onSubirLogo={(f) => void subirLogo(f)}
            onQuitarLogo={() => setLogo({ id: null, url: null })}
            subiendo={subiendoLogo}
          />
        </AccentCard>
        </Box>

        <AccentCard
          icon={<Key />}
          title="Google AdSense"
          accent="warning"
          description="IDs de publisher y slots para los banners del sitio. Los lee el sitio en tiempo real."
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Publisher ID de tu cuenta de AdSense. Formato: ca-pub-XXXXXXXXXXXXXXXX">
              <Field.Label>Publisher ID</Field.Label>
              <TextInput
                placeholder="ca-pub-XXXXXXXXXXXXXXXX"
                value={form.adsensePublisherId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("adsensePublisherId", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            <Box paddingTop={1}>
              <GroupLabel>Slots de anuncios</GroupLabel>
            </Box>

            <Flex gap={3} alignItems="flex-start">
              <Box flex="1">
                <Field.Root hint="Sidebar izquierdo (visible en pantallas ≥1536px).">
                  <Field.Label>Sidebar izquierdo</Field.Label>
                  <TextInput
                    placeholder="0000000001"
                    value={form.adsenseSidebarLeftSlot}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      set("adsenseSidebarLeftSlot", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              </Box>
              <Box flex="1">
                <Field.Root hint="Sidebar derecho.">
                  <Field.Label>Sidebar derecho</Field.Label>
                  <TextInput
                    placeholder="0000000002"
                    value={form.adsenseSidebarRightSlot}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      set("adsenseSidebarRightSlot", e.target.value)
                    }
                  />
                  <Field.Hint />
                </Field.Root>
              </Box>
            </Flex>

            <Field.Root hint="Ad in-feed que reemplaza la 3era noticia en la home.">
              <Field.Label>In-feed home</Field.Label>
              <TextInput
                placeholder="0000000003"
                value={form.adsenseHomeInFeedSlot}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("adsenseHomeInFeedSlot", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            <Field.Root hint="Banner horizontal responsive visible solo en mobile/tablet (<1536px), donde los sidebars no aparecen.">
              <Field.Label>Banner mobile</Field.Label>
              <TextInput
                placeholder="0000000004"
                value={form.adsenseMobileBannerSlot}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("adsenseMobileBannerSlot", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            <Field.Root hint="Ad insertado al final del cuerpo de cada post del blog (mobile + desktop).">
              <Field.Label>In-article (posts)</Field.Label>
              <TextInput
                placeholder="0000000005"
                value={form.adsenseInArticleSlot}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("adsenseInArticleSlot", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            <Hairline />

            <Field.Root hint="Cuando está activo, los house ads cargados en la colección 'House ad' reemplazan los slots de AdSense por slot. Desactivado = todos los slots vuelven a AdSense.">
              <Field.Label>Mostrar house ads en lugar de AdSense</Field.Label>
              <Box paddingTop={1}>
                <Toggle
                  onLabel="Sí"
                  offLabel="No"
                  checked={form.houseAdsEnabled}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    set("houseAdsEnabled", e.target.checked)
                  }
                />
              </Box>
              <Field.Hint />
            </Field.Root>
          </Flex>
        </AccentCard>

        <AccentCard
          icon={<ChartPie />}
          title="Google Analytics & Search Console"
          accent="success"
          description="GA4 + verificación de Search Console. Los lee el sitio; el tag de GA solo se inyecta en producción."
        >
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint="Measurement ID de tu propiedad GA4. Formato: G-XXXXXXXXXX (Admin → Flujos de datos → tu sitio).">
              <Field.Label>GA4 — Measurement ID</Field.Label>
              <TextInput
                placeholder="G-XXXXXXXXXX"
                value={form.googleAnalyticsId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("googleAnalyticsId", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>

            <Field.Root hint="Search Console → método 'Etiqueta HTML': pegá SOLO el valor del content (no la etiqueta completa).">
              <Field.Label>Search Console — verification token</Field.Label>
              <TextInput
                placeholder="abc123Def456..."
                value={form.googleSiteVerification}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  set("googleSiteVerification", e.target.value)
                }
              />
              <Field.Hint />
            </Field.Root>
          </Flex>
        </AccentCard>

        <AccentCard
          icon={<Eye />}
          title="Microsoft Clarity"
          accent="primary"
          description="Heatmaps y grabaciones de sesión. Lo lee el sitio; el script solo se inyecta en producción."
        >
          <Field.Root hint="Project ID de Clarity (clarity.microsoft.com → Settings → Overview). Ej: wzkcreip2d">
            <Field.Label>Project ID</Field.Label>
            <TextInput
              placeholder="xxxxxxxxxx"
              value={form.clarityProjectId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                set("clarityProjectId", e.target.value)
              }
            />
            <Field.Hint />
          </Field.Root>
        </AccentCard>

        {/* Las tarjetas del proyecto, al final: los ajustes propios de un módulo
            que sólo existe en esta instalación. */}
        {VERTICAL_CARDS.map((card) => (
          <div key={card.id} id={card.id}>
            <AccentCard
              icon={card.icon}
              title={card.title}
              accent={card.accent}
              description={card.description}
            >
              <Flex direction="column" alignItems="stretch" gap={4}>
                {card.fields.map((campo) => (
                  <CampoVertical
                    key={campo.key}
                    campo={campo}
                    valor={form[campo.key]}
                    onChange={(v) => set(campo.key, v)}
                  />
                ))}
              </Flex>
            </AccentCard>
          </div>
        ))}
      </Box>

      <SaveBar dirty={dirty} saving={saving} onSave={handleSave} onDiscard={handleDiscard} />
    </PageContainer>
  );
}

// ── Uso / créditos de las APIs de IA ──────────────────────────────────────
type AiUsage = {
  openrouter: {
    ok: boolean;
    configured: boolean;
    totalCredits?: number | null;
    totalUsage?: number | null;
    remaining?: number | null;
    keyUsage?: { total: number | null; daily: number | null; weekly: number | null; monthly: number | null };
  };
  openai: {
    ok: boolean;
    configured: boolean;
    hasAdminKey?: boolean;
    reason?: string;
    dashboardUrl?: string;
    monthlyCost?: number;
    /** Desglose del mes por modelo. Los de texto traen tokens; los de imagen, imágenes. */
    models?: Array<{
      model: string;
      tokensIn?: number;
      tokensCached?: number;
      tokensOut?: number;
      images?: number;
      requests?: number;
    }>;
  };
};

const usd = (n: number | null | undefined) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");

/** 1.243.117 → «1,2 M». Los tokens se cuentan en millones y el número entero no se lee. */
const compacto = (n: number | undefined): string => {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1).replace(".", ",")} MM`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(".", ",")} M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} k`;
  return String(n);
};

function UsageBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const accent = pct >= 85 ? "danger500" : pct >= 60 ? "warning500" : "success500";
  return (
    <Box background="neutral150" hasRadius style={{ height: 8, overflow: "hidden", width: "100%" }}>
      <Box background={accent} style={{ height: 8, width: `${pct}%` }} />
    </Box>
  );
}

function AiUsageCard() {
  const { get } = useFetchClient();
  const [data, setData] = React.useState<AiUsage | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    get("/api/usage/ai")
      .then(({ data }: { data: AiUsage }) => setData(data))
      .catch(() => setError(true));
  }, [get]);

  const or = data?.openrouter;
  const oa = data?.openai;

  return (
    <AccentCard icon={<Magic />} title="Uso y costo de IA" description="Datos en vivo de las APIs. OpenRouter es prepago y muestra saldo; OpenAI es pospago y sólo publica consumo." accent="success">
      {!data && !error ? (
        <Flex justifyContent="center" padding={3}><Loader small>Consultando…</Loader></Flex>
      ) : error ? (
        <Typography variant="pi" textColor="danger600">No se pudo consultar el uso de las APIs.</Typography>
      ) : (
        <Flex direction="column" alignItems="stretch" gap={4}>
          {/* OpenRouter */}
          <Box>
            <Flex justifyContent="space-between" alignItems="baseline" marginBottom={2}>
              <GroupLabel>OpenRouter</GroupLabel>
              {or?.ok ? (
                <Typography variant="omega" fontWeight="bold" textColor="success600">
                  {usd(or.remaining)} disponibles
                </Typography>
              ) : (
                <Typography variant="pi" textColor="neutral500">{or?.configured ? "sin datos" : "no configurada"}</Typography>
              )}
            </Flex>
            {or?.ok ? (
              <>
                <UsageBar used={or.totalUsage ?? 0} total={or.totalCredits ?? 0} />
                <Flex justifyContent="space-between" marginTop={1}>
                  <Typography variant="pi" textColor="neutral600">
                    Usados {usd(or.totalUsage)} de {usd(or.totalCredits)}
                  </Typography>
                  <Typography variant="pi" textColor="neutral500">
                    Hoy {usd(or.keyUsage?.daily)} · Semana {usd(or.keyUsage?.weekly)} · Mes {usd(or.keyUsage?.monthly)}
                  </Typography>
                </Flex>
              </>
            ) : null}
          </Box>

          <Hairline />

          {/* OpenAI */}
          <Box>
            <Flex justifyContent="space-between" alignItems="baseline" marginBottom={1}>
              <GroupLabel>OpenAI</GroupLabel>
              {oa?.ok && typeof oa.monthlyCost === "number" ? (
                <Typography variant="omega" fontWeight="bold" textColor="neutral800">
                  {usd(oa.monthlyCost)} este mes
                </Typography>
              ) : (
                <Typography variant="pi" textColor="neutral500">{!oa?.configured ? "sin clave" : "sin Admin key"}</Typography>
              )}
            </Flex>
            {oa?.models && oa.models.length > 0 ? (
              <Box paddingTop={1} paddingBottom={2}>
                {oa.models.map((m) => (
                  <Flex key={m.model} justifyContent="space-between" alignItems="baseline" paddingTop={1} gap={3}>
                    <Typography variant="pi" textColor="neutral700" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.model}
                    </Typography>
                    <Typography variant="pi" textColor="neutral500" style={{ flexShrink: 0 }}>
                      {typeof m.images === "number"
                        ? `${compacto(m.images)} imágenes`
                        : `${compacto(m.tokensIn)} ent · ${compacto(m.tokensOut)} sal`}
                      {typeof m.requests === "number" ? ` · ${compacto(m.requests)} req` : ""}
                    </Typography>
                  </Flex>
                ))}
              </Box>
            ) : oa?.ok ? (
              <Typography variant="pi" textColor="neutral500">Sin consumo este mes.</Typography>
            ) : null}
            <Typography variant="pi" textColor="neutral600">
              {oa?.reason ?? "—"}{" "}
              {oa?.dashboardUrl ? (
                <a href={oa.dashboardUrl} target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>
                  Ver en el dashboard
                </a>
              ) : null}
            </Typography>
          </Box>
        </Flex>
      )}
    </AccentCard>
  );
}
