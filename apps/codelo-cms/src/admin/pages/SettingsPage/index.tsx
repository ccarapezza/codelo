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
import { Key, Magic, ChartPie, Eye, Cog } from "@strapi/icons";
import { createGlobalStyle } from "styled-components";
import { PageContainer, PageHeader, AccentCard, Hairline, GroupLabel, SaveBar } from "../../components/ui";

import { useFetchClient, useNotification } from "@strapi/strapi/admin";

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

type Settings = {
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
  houseAdsEnabled: boolean;
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
  houseAdsEnabled: false,
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

export default function SettingsPage() {
  const { get, put } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [form, setForm] = React.useState<Settings>(EMPTY);
  const [saved, setSaved] = React.useState<Settings>(EMPTY);
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
          houseAdsEnabled: Boolean(data.houseAdsEnabled),
        };
        setForm(next);
        setSaved(next);
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
      await put(ADMIN_API, form);
      setSaved(form);
      toggleNotification({ type: "success", message: "Configuración guardada." });
    } catch {
      toggleNotification({ type: "danger", message: "Error al guardar la configuración." });
    } finally {
      setSaving(false);
    }
  }, [form, put, toggleNotification]);

  const handleDiscard = () => setForm(saved);

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
        subtitle="Integraciones externas del sitio. Las claves de OpenAI se leen desde las env vars OPENAI_API_KEY / OPENAI_IMAGE_API_KEY."
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
          description="API keys por env var: OPENAI_API_KEY (texto e imágenes), OPENAI_IMAGE_API_KEY (override opcional) y OPENROUTER_API_KEY (para imágenes con Nano Banana / Gemini vía OpenRouter)."
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
          icon={<Key />}
          title="Google AdSense"
          accent="warning"
          description="IDs de publisher y slots para los banners del sitio. Se leen en tiempo real por codelo-web."
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
          description="GA4 + verificación de Search Console. Los lee codelo-web; el tag de GA solo se inyecta en producción."
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
          description="Heatmaps y grabaciones de sesión. Lo lee codelo-web; el script solo se inyecta en producción."
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
  openai: { ok: boolean; configured: boolean; reason?: string; dashboardUrl?: string; monthlyCost?: number };
};

const usd = (n: number | null | undefined) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");

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
    <AccentCard icon={<Magic />} title="Uso de IA · Créditos" description="Datos en vivo de las APIs. OpenAI no expone saldo vía API." accent="success">
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
                <Typography variant="pi" textColor="neutral500">{oa?.configured ? "saldo no disponible" : "no configurada"}</Typography>
              )}
            </Flex>
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
