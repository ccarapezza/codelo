import * as React from "react";
import {
  Box,
  Button,
  Field,
  Flex,
  Loader,
  NumberInput,
  SingleSelect,
  SingleSelectOption,
  Textarea,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { Check, Cross, Images, Magic, PaperPlane, Play } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useSearchParams } from "react-router-dom";
import { AccentCard, EmptyState, GroupLabel, Hairline, IconChip, PageContainer } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import BackgroundPickerModal from "./BackgroundPickerModal";
import DeckEditor from "./DeckEditor";
import JobProgress from "./JobProgress";
import ReelEditor from "./ReelEditor";
import StoryVideoEditor from "./StoryVideoEditor";
import {
  estimateCost,
  OVERLAY_FIELDS,
  type BackgroundFile,
  type DeckResult,
  type JobState,
  type PortadaResult,
  type ReelResult,
  type Slide,
  type StoryVideoResult,
  type StudioConfig,
  type StudioFormat,
  type StudioState,
} from "./types";
import { useT } from "../../i18n";

// Títulos y descripciones son claves: se traducen al renderizar.
const FORMAT_META: Array<{ key: StudioFormat; title: string; description: string }> = [
  { key: "portada", title: "ss.formato.portada.titulo", description: "ss.formato.portada" },
  { key: "carrusel", title: "ss.formato.carrusel.titulo", description: "ss.formato.carrusel" },
  { key: "historia", title: "ss.formato.historia.titulo", description: "ss.formato.historia" },
  { key: "reel", title: "ss.formato.reel.titulo", description: "ss.formato.video" },
];

type PostHit = { documentId: string; title: string };

export default function SocialStudioPage() {
  const t = useT();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();

  const [config, setConfig] = React.useState<StudioConfig | null>(null);
  const [state, setState] = React.useState<StudioState>({
    sourceMode: "post",
    post: null,
    customPrompt: "",
    format: "carrusel",
    imageModel: "",
    bgFile: null,
    slideCount: 6,
    template: "cover",
    historiaOutput: "image",
    videoModel: "",
    videoSeconds: 8,
    videoPrompt: "",
    clipFile: null,
    overlayType: "title",
    overlayFields: {},
  });
  const set = <K extends keyof StudioState>(key: K, value: StudioState[K]) =>
    setState((prev) => ({ ...prev, [key]: value }));

  // --- búsqueda de notas -----------------------------------------------------
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<PostHit[]>([]);
  const [searching, setSearching] = React.useState(false);

  React.useEffect(() => {
    if (state.sourceMode !== "post" || state.post) return;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const qs = new URLSearchParams({
          "fields[0]": "title",
          "fields[1]": "documentId",
          "sort[0]": "publishedAt:desc",
          "pagination[pageSize]": "8",
        });
        if (query.trim()) qs.set("filters[title][$containsi]", query.trim());
        const { data } = await get(`/api/posts?${qs.toString()}`);
        setHits(((data as { data: PostHit[] }).data ?? []).map((p) => ({ documentId: p.documentId, title: p.title })));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query, state.sourceMode, state.post, get]);

  // --- carga inicial: config + deep-link ?post= ------------------------------
  React.useEffect(() => {
    get("/api/social-studio/config")
      .then(({ data }: { data: StudioConfig }) => {
        setConfig(data);
        setState((prev) => ({
          ...prev,
          imageModel: data.defaults.imageModel,
          videoModel: data.defaults.videoModel,
          videoPrompt: data.defaults.videoPrompt,
        }));
      })
      .catch(() => toggleNotification({ type: "danger", message: t("ss.err.config") }));

    const preselect = searchParams.get("post");
    if (preselect) {
      get(`/api/posts?filters[documentId][$eq]=${preselect}&fields[0]=title&fields[1]=documentId`)
        .then(({ data }: { data: { data: PostHit[] } }) => {
          const p = data.data?.[0];
          if (p) setState((prev) => ({ ...prev, sourceMode: "post", post: { documentId: p.documentId, title: p.title } }));
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- job -------------------------------------------------------------------
  const [job, setJob] = React.useState<JobState | null>(null);
  const [launching, setLaunching] = React.useState(false);
  const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };
  React.useEffect(() => stopPolling, []);

  const pollJob = React.useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { data } = await get(`/api/social-studio/jobs/${jobId}`);
          const j = data as JobState;
          setJob(j);
          if (j.status !== "running") stopPolling();
        } catch {
          stopPolling();
          setJob(null);
          toggleNotification({
            type: "warning",
            message: t("ss.err.expiro"),
          });
        }
      }, 2500);
    },
    [get, toggleNotification],
  );

  const launch = async (overrides?: Record<string, unknown>) => {
    if (!config) return;
    setLaunching(true);
    try {
      const source =
        state.sourceMode === "post" && state.post
          ? { postDocumentId: state.post.documentId }
          : { customPrompt: state.customPrompt };
      const body = {
        format: state.format,
        source,
        options: {
          imageModel: state.imageModel || undefined,
          bgFileId: state.bgFile?.id,
          slideCount: state.slideCount,
          template: state.template,
          output: state.format === "historia" ? state.historiaOutput : undefined,
          videoModel: state.videoModel || undefined,
          videoSeconds: state.videoSeconds,
          videoPrompt: state.videoPrompt || undefined,
          clipFileId: state.clipFile?.id,
          overlay: state.format === "reel" ? { type: state.overlayType, fields: state.overlayFields } : undefined,
          ...overrides,
        },
      };
      const { data } = await post("/api/social-studio/generate", body);
      const { jobId } = data as { jobId: string };
      setJob({ id: jobId, kind: state.format, status: "running", steps: [], estimatedCostUsd: 0 });
      pollJob(jobId);
    } catch (err) {
      const detail = (err as { response?: { data?: { error?: { message?: string }; message?: string } } }).response?.data;
      toggleNotification({
        type: "danger",
        message: detail?.error?.message || detail?.message || t("ss.err.lanzar"),
      });
    } finally {
      setLaunching(false);
    }
  };

  // Recomponer reel reusando el clip → $0 de IA.
  const recomposeReel = (overlay: { type: "title" | "countdown"; fields: Record<string, string> }, clipFileId: number) => {
    setState((prev) => ({ ...prev, overlayType: overlay.type, overlayFields: overlay.fields }));
    void launch({ clipFileId, overlay });
  };

  // --- fondo / picker ---------------------------------------------------------
  const [pickerOpen, setPickerOpen] = React.useState<"image" | "video" | null>(null);

  if (!config) {
    return (
      <PageContainer>
        <Flex justifyContent="center" alignItems="center" minHeight="50vh">
          <Loader>{t("ss.cargando")}</Loader>
        </Flex>
      </PageContainer>
    );
  }

  const sourceReady = state.sourceMode === "post" ? state.post !== null : state.customPrompt.trim().length > 0;
  const isVideoFormat = state.format === "reel" || (state.format === "historia" && state.historiaOutput === "video");
  const videoBlocked = isVideoFormat && !config.ffmpegAvailable;
  const keysMissing = isVideoFormat ? !state.clipFile && !config.keys.openrouter : !config.keys.openai;
  const canGenerate = sourceReady && !videoBlocked && !keysMissing && !launching && job?.status !== "running";
  const plan = estimateCost(config, state);
  const result = job?.status === "completed" ? job.result : undefined;

  const recomposeStoryVideo = (slide: Slide, clipFileId: number) => {
    void launch({ slide, clipFileId, output: "video" });
  };

  // ----- bloques reutilizados en el layout -----
  const fuenteCard = (
    <AccentCard icon={<PaperPlane />} title={t("ss.fuente")} accent="primary">
      <Flex direction="column" alignItems="stretch" gap={3}>
        <Flex gap={2}>
          <Button variant={state.sourceMode === "post" ? "default" : "tertiary"} onClick={() => set("sourceMode", "post")}>{t("ss.desdeNota")}</Button>
          <Button variant={state.sourceMode === "prompt" ? "default" : "tertiary"} onClick={() => set("sourceMode", "prompt")}>
            {t("ss.promptPropio")}
          </Button>
        </Flex>

        {state.sourceMode === "post" ? (
          state.post ? (
            <Flex gap={2} alignItems="center" justifyContent="space-between" background="neutral100" hasRadius padding={2}>
              <Typography variant="omega" fontWeight="bold" textColor="neutral800" ellipsis>
                {state.post.title}
              </Typography>
              <Button variant="tertiary" startIcon={<Cross />} onClick={() => set("post", null)}>
                {t("ss.cambiar")}
              </Button>
            </Flex>
          ) : (
            <Flex direction="column" alignItems="stretch" gap={2}>
              <TextInput
                placeholder={t("ss.buscarNota")}
                value={query}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
              />
              {searching ? (
                <Typography variant="pi" textColor="neutral500">{t("ss.buscando")}</Typography>
              ) : (
                <Box style={{ maxHeight: 168, overflowY: "auto" }}>
                  <Flex direction="column" alignItems="stretch" gap={1}>
                    {hits.map((p) => (
                      <button
                        key={p.documentId}
                        type="button"
                        onClick={() => set("post", p)}
                        // width:100% + minWidth:0 para que el `ellipsis` del título
                        // tenga un ancho que respetar (si no, el texto en nowrap
                        // estira el botón más allá de la pantalla).
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", width: "100%", minWidth: 0 }}
                      >
                        <Box paddingTop={1} paddingBottom={1} paddingLeft={2} paddingRight={2} hasRadius background="neutral100" style={{ overflow: "hidden" }}>
                          <Typography variant="pi" textColor="neutral700" ellipsis>{p.title}</Typography>
                        </Box>
                      </button>
                    ))}
                    {hits.length === 0 ? (
                      <Typography variant="pi" textColor="neutral500">{t("ss.sinResultados")}</Typography>
                    ) : null}
                  </Flex>
                </Box>
              )}
            </Flex>
          )
        ) : (
          <Field.Root hint={t("ss.portadaEsPrompt")}>
            <Field.Label>Prompt</Field.Label>
            <Textarea value={state.customPrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set("customPrompt", e.target.value)} />
            <Field.Hint />
          </Field.Root>
        )}
      </Flex>
    </AccentCard>
  );

  const planCard = (
    <AccentCard icon={<Check />} title={t("ss.planCostos")} accent={plan.totalUsd > 0.5 ? "danger" : "success"}>
      <Flex direction="column" alignItems="stretch" gap={2}>
        {plan.lines.map((l, i) => (
          <Flex key={i} justifyContent="space-between" gap={3}>
            <Typography variant="pi" textColor="neutral600">{t(l.label, l.params)}</Typography>
            <Typography variant="pi" fontWeight="bold" textColor={l.usd === 0 ? "success600" : "neutral800"}>
              {l.usd === 0 ? "$0.00" : `~$${l.usd.toFixed(3)}`}
            </Typography>
          </Flex>
        ))}
        <Hairline />
        <Flex justifyContent="space-between">
          <Typography variant="omega" fontWeight="bold">{t("ss.totalEstimado")}</Typography>
          <Typography variant="omega" fontWeight="bold" textColor={plan.totalUsd === 0 ? "success600" : "warning600"}>
            ~${plan.totalUsd.toFixed(3)} USD
          </Typography>
        </Flex>
        <Typography variant="pi" textColor="neutral500">{t("ss.planCostos.nota")}</Typography>
        {keysMissing ? (
          <Typography variant="pi" textColor="danger600">
            {t("ss.faltaApiKey", { proveedor: state.format === "reel" ? "OpenRouter (OPENROUTER_API_KEY)" : "OpenAI (OPENAI_API_KEY)" })}
          </Typography>
        ) : null}
      </Flex>
    </AccentCard>
  );

  // Selected-format meta (drives the top-bar tabs + the left-panel subtitle).
  const currentFormat = FORMAT_META.find((f) => f.key === state.format)!;

  // Segmented format switcher — lives in the top bar instead of its own card.
  const formatTabs = (
    <Flex gap={1} wrap="wrap" background="neutral100" hasRadius padding={1} style={{ borderRadius: 8 }}>
      {FORMAT_META.map((f) => {
        const selected = state.format === f.key;
        const disabled = f.key === "reel" && !config.ffmpegAvailable;
        return (
          <button
            key={f.key}
            type="button"
            disabled={disabled}
            onClick={() => set("format", f.key)}
            style={{ background: "none", border: "none", padding: 0, cursor: disabled ? "not-allowed" : "pointer" }}
          >
            <Box
              paddingTop={2}
              paddingBottom={2}
              paddingLeft={4}
              paddingRight={4}
              hasRadius
              background={selected ? "neutral0" : "transparent"}
              borderColor={selected ? "primary600" : "transparent"}
              borderWidth="1px"
              borderStyle="solid"
              shadow={selected ? "filterShadow" : undefined}
              style={{ opacity: disabled ? 0.4 : 1, borderRadius: 6 }}
            >
              <Typography
                variant="omega"
                fontWeight={selected ? "bold" : "regular"}
                textColor={selected ? "primary700" : "neutral700"}
              >
                {t(f.title)}
              </Typography>
            </Box>
          </button>
        );
      })}
    </Flex>
  );

  const modelosCard = (
    <AccentCard icon={<Magic />} title={isVideoFormat ? t("ss.modeloVideo.titulo") : t("ss.modeloImagen.titulo")} accent="warning">
      <Flex direction="column" alignItems="stretch" gap={4}>
        {state.format === "historia" ? (
          <Field.Root hint={t("ss.historia.nota")}>
            <Field.Label>{t("ss.salida")}</Field.Label>
            <Flex gap={2}>
              <Button
                variant={state.historiaOutput === "image" ? "default" : "tertiary"}
                onClick={() => set("historiaOutput", "image")}
              >
                {t("ss.salida.imagen")}
              </Button>
              <Button
                variant={state.historiaOutput === "video" ? "default" : "tertiary"}
                disabled={!config.ffmpegAvailable}
                onClick={() => set("historiaOutput", "video")}
              >
                Video
              </Button>
            </Flex>
            <Field.Hint />
          </Field.Root>
        ) : null}

        {state.format === "historia" ? (
          <Field.Root>
            <Field.Label>{t("ss.template")}</Field.Label>
            <SingleSelect value={state.template} onChange={(v: string | number) => set("template", String(v) as StudioState["template"])}>
              <SingleSelectOption value="cover">{t("ss.template.cover")}</SingleSelectOption>
              <SingleSelectOption value="stat">{t("ss.template.stat")}</SingleSelectOption>
              <SingleSelectOption value="quote">{t("ss.template.quote")}</SingleSelectOption>
              <SingleSelectOption value="countdown">Countdown</SingleSelectOption>
            </SingleSelect>
          </Field.Root>
        ) : null}

        {!isVideoFormat ? (
          <>
            <Field.Root hint={t("ss.fondoIA.hint")}>
              <Field.Label>{t("ss.modeloImagen")}</Field.Label>
              <SingleSelect value={state.imageModel} onChange={(v: string | number) => set("imageModel", String(v))}>
                {Object.entries(config.imageModels).map(([id, m]) => (
                  <SingleSelectOption key={id} value={id}>
                    {`${m.label} — ~$${m.costPerImage}/img`}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
              <Field.Hint />
            </Field.Root>

            {state.format === "carrusel" ? (
              <Field.Root>
                <Field.Label>{t("ss.cantidadPlacas")}</Field.Label>
                <NumberInput value={state.slideCount} onValueChange={(v?: number) => set("slideCount", Math.max(3, Math.min(v ?? 6, 7)))} />
              </Field.Root>
            ) : null}

            {state.format !== "portada" ? (
              <>
                <Hairline />
                <GroupLabel>{t("ss.fondoPortada")}</GroupLabel>
                {state.bgFile ? (
                  <Flex gap={2} alignItems="center" justifyContent="space-between">
                    <Flex gap={2} alignItems="center" style={{ minWidth: 0 }}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <img src={state.bgFile.url} style={{ width: 36, height: 64, objectFit: "cover", borderRadius: 4 }} />
                      <Typography variant="pi" textColor="neutral600" ellipsis>{state.bgFile.name}</Typography>
                    </Flex>
                    <Button variant="tertiary" startIcon={<Cross />} onClick={() => set("bgFile", null)}>{t("ss.quitar")}</Button>
                  </Flex>
                ) : (
                  <Flex gap={2}>
                    <Button variant="secondary" startIcon={<Images />} onClick={() => setPickerOpen("image")}>
                      {t("ss.usarFondo")}
                    </Button>
                  </Flex>
                )}
                <Typography variant="pi" textColor="neutral500">{t("ss.fondoPortada.hint")}</Typography>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Field.Root hint={t("ss.modeloVideo.hint")}>
              <Field.Label>{t("ss.modeloVideo")}</Field.Label>
              <SingleSelect value={state.videoModel} onChange={(v: string | number) => set("videoModel", String(v))}>
                {Object.entries(config.videoModels).map(([id, m]) => (
                  <SingleSelectOption key={id} value={id}>
                    {`${m.label} — $${m.pricePerSec}/s · ${t("ss.maxSeg", { n: m.maxSeconds })}${m.audio ? " · audio" : ""}`}
                  </SingleSelectOption>
                ))}
              </SingleSelect>
              <Field.Hint />
            </Field.Root>

            <Field.Root>
              <Field.Label>{t("ss.duracion")}</Field.Label>
              <NumberInput
                value={state.videoSeconds}
                onValueChange={(v?: number) => {
                  const max = config.videoModels[state.videoModel]?.maxSeconds ?? 8;
                  set("videoSeconds", Math.max(3, Math.min(v ?? 8, max)));
                }}
              />
            </Field.Root>

            {state.format === "reel" ? (
              <>
                <Field.Root>
                  <Field.Label>{t("ss.overlay")}</Field.Label>
                  <SingleSelect value={state.overlayType} onChange={(v: string | number) => set("overlayType", String(v) as StudioState["overlayType"])}>
                    <SingleSelectOption value="title">{t("ss.overlay.titulo")}</SingleSelectOption>
                    <SingleSelectOption value="countdown">{t("ss.overlay.countdown")}</SingleSelectOption>
                  </SingleSelect>
                </Field.Root>

                {OVERLAY_FIELDS[state.overlayType].map((f) => (
                  <Field.Root key={f.key}>
                    <Field.Label>{t(f.label)}</Field.Label>
                    <TextInput
                      placeholder={f.placeholder ? t(f.placeholder) : undefined}
                      value={state.overlayFields[f.key] ?? ""}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("overlayFields", { ...state.overlayFields, [f.key]: e.target.value })}
                    />
                  </Field.Root>
                ))}
              </>
            ) : (
              <Typography variant="pi" textColor="neutral500">{t("ss.overlay.nota")}</Typography>
            )}

            <Hairline />
            <GroupLabel>{t("ss.clipFondo")}</GroupLabel>
            {state.clipFile ? (
              <Flex gap={2} alignItems="center" justifyContent="space-between">
                <Typography variant="pi" textColor="neutral600" ellipsis>{state.clipFile.name}</Typography>
                <Button variant="tertiary" startIcon={<Cross />} onClick={() => set("clipFile", null)}>{t("ss.quitar")}</Button>
              </Flex>
            ) : (
              <>
                <Field.Root hint={t("ss.clipFondo.hint")}>
                  <Field.Label>{t("ss.promptClip")}</Field.Label>
                  <Textarea value={state.videoPrompt} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => set("videoPrompt", e.target.value)} />
                  <Field.Hint />
                </Field.Root>
                <Flex gap={2}>
                  <Button variant="secondary" startIcon={<Play />} onClick={() => setPickerOpen("video")}>
                    {t("ss.usarClip")}
                  </Button>
                </Flex>
              </>
            )}
          </>
        )}
      </Flex>
    </AccentCard>
  );

  const stateArea = !job ? (
    <Box background="neutral0" borderColor="neutral200" borderWidth="1px" borderStyle="solid" hasRadius>
      <EmptyState
        icon={<Magic />}
        title={t("ss.configura.titulo")}
        description={t("ss.configura.desc")}
      />
    </Box>
  ) : job.status === "running" || job.status === "failed" ? (
    <JobProgress job={job} />
  ) : result?.type === "deck" ? (
    <DeckEditor
      key={job.id}
      result={result as DeckResult}
      postDocumentId={state.sourceMode === "post" ? state.post?.documentId ?? null : null}
      onSaved={() => {}}
    />
  ) : result?.type === "reel" ? (
    <ReelEditor key={job.id} jobId={job.id} result={result as ReelResult} onRecompose={recomposeReel} onSaved={() => {}} />
  ) : result?.type === "story-video" ? (
    <StoryVideoEditor
      key={job.id}
      jobId={job.id}
      result={result as StoryVideoResult}
      onRecompose={recomposeStoryVideo}
      onSaved={() => {}}
    />
  ) : result?.type === "portada" ? (
    <PortadaView result={result as PortadaResult} postDocumentId={state.sourceMode === "post" ? state.post?.documentId ?? null : null} />
  ) : null;

  return (
    <PageContainer>
      {/* ── Barra superior ───────────────────────────────────────────────
          Modo (tabs de formato) a la izquierda, total + Generar a la
          derecha. Sticky (mismo truco de márgenes negativos que SaveBar)
          para que la acción principal quede siempre a la vista. */}
      <Box
        position="sticky"
        top={0}
        paddingTop={4}
        paddingBottom={4}
        paddingLeft={8}
        paddingRight={8}
        background="neutral0"
        borderColor="neutral200"
        borderWidth="0 0 1px 0"
        borderStyle="solid"
        style={{ marginTop: -40, marginLeft: -40, marginRight: -40, marginBottom: 24, zIndex: 10 }}
      >
        <Flex justifyContent="space-between" alignItems={isMobile ? "stretch" : "center"} gap={isMobile ? 3 : 4} wrap="wrap" direction={isMobile ? "column" : "row"}>
          <Flex
            gap={isMobile ? 2 : 3}
            alignItems={isMobile ? "flex-start" : "center"}
            direction={isMobile ? "column" : "row"}
            style={{ minWidth: 0 }}
          >
            <Flex gap={3} alignItems="center">
              <IconChip icon={<Magic />} accent="primary" size={36} />
              <Typography variant="beta" textColor="neutral800">Social Studio</Typography>
            </Flex>
            <Box marginLeft={isMobile ? 0 : 2}>{formatTabs}</Box>
            {!isMobile ? (
              <Typography variant="pi" textColor="neutral500">{t(currentFormat.description)}</Typography>
            ) : null}
          </Flex>

          <Flex gap={4} alignItems="center">
            <Flex direction="column" alignItems="flex-end" gap={0}>
              <Typography variant="pi" textColor="neutral500">{t("ss.totalEstimado")}</Typography>
              <Typography variant="omega" fontWeight="bold" textColor={plan.totalUsd === 0 ? "success600" : "warning600"}>
                ~${plan.totalUsd.toFixed(3)} USD
              </Typography>
            </Flex>
            <Button size="L" startIcon={<Magic />} disabled={!canGenerate} loading={launching} onClick={() => launch()}>
              {t("ss.generar")}
            </Button>
          </Flex>
        </Flex>
      </Box>

      {/* ── Editor: 3 columnas en desktop (config · preview · plan), apiladas
          en mobile (si no, el mínimo ~560px desborda la pantalla). ─────── */}
      <Box
        style={{
          display: "grid",
          // minmax(0, 1fr) y no "1fr": "1fr" = minmax(auto,1fr), y ese `auto`
          // deja que la columna se estire al min-content (el título de nota más
          // largo en nowrap), desbordando la pantalla. minmax(0,…) lo capea.
          gridTemplateColumns: isMobile
            ? "minmax(0, 1fr)"
            : "minmax(300px, 340px) minmax(0, 1fr) minmax(260px, 300px)",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Izquierda: configuración (fuente + modelos del modo elegido). */}
        <Flex direction="column" alignItems="stretch" gap={4}>
          {fuenteCard}
          {modelosCard}
          {!config.ffmpegAvailable ? (
            <Typography variant="pi" textColor="warning600">{t("ss.reelDeshabilitado")}</Typography>
          ) : null}
        </Flex>

        {/* Centro: preview / editor del resultado (el lienzo). */}
        <Box style={{ minWidth: 0, minHeight: 520 }}>{stateArea}</Box>

        {/* Derecha: plan de costos. */}
        <Box>{planCard}</Box>
      </Box>

      <BackgroundPickerModal
        open={pickerOpen !== null}
        type={pickerOpen ?? "image"}
        onClose={() => setPickerOpen(null)}
        onPick={(file: BackgroundFile) => {
          if (pickerOpen === "video") set("clipFile", file);
          else set("bgFile", file);
          setPickerOpen(null);
        }}
      />
    </PageContainer>
  );
}

// Resultado de portada: imagen + aplicar a la nota (si hay nota elegida).
function PortadaView({ result, postDocumentId }: { result: PortadaResult; postDocumentId: string | null }) {
  const t = useT();
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [saving, setSaving] = React.useState(false);
  const [applied, setApplied] = React.useState(false);

  const apply = async () => {
    if (!postDocumentId) return;
    setSaving(true);
    try {
      await post("/api/social-studio/save", {
        format: "portada",
        postDocumentId,
        fileId: result.fileId,
        imagePrompt: result.imagePrompt,
      });
      setApplied(true);
      toggleNotification({ type: "success", message: t("ss.ok.portada") });
    } catch {
      toggleNotification({ type: "danger", message: t("ss.err.portada") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccentCard title={t("gen.portadaGenerada")} description={t("ss.imagenEnMedios")} accent="success">
      <Flex gap={5} alignItems="flex-start" wrap="wrap">
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={result.url} style={{ width: 320, maxWidth: "100%", borderRadius: 8, display: "block" }} />
        <Flex direction="column" alignItems="stretch" gap={3} style={{ flex: 1, minWidth: 240 }}>
          <Typography variant="pi" textColor="neutral600">{t("ss.promptX", { prompt: result.imagePrompt })}</Typography>
          {postDocumentId ? (
            <Button size="L" startIcon={<Check />} loading={saving} disabled={applied} onClick={apply}>
              {applied ? t("ss.aplicada") : t("ss.usarComoPortada")}
            </Button>
          ) : (
            <Typography variant="pi" textColor="neutral500">
              {t("ss.generadaSuelta")}
            </Typography>
          )}
        </Flex>
      </Flex>
    </AccentCard>
  );
}
