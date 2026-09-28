import React from "react";
import {
  Box,
  Button,
  Flex,
  Typography,
  IconButton,
  Modal,
  Field,
  TextInput,
  Switch,
  Badge,
  Loader,
  Dialog,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@strapi/design-system";
import { Plus, Pencil, Trash, Play, Globe, Search } from "@strapi/icons";
import {
  useFetchClient,
  useNotification,
} from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";
import { useIsMobile } from "../../hooks/useIsMobile";
import DiscoverModal from "./DiscoverModal";
import { useLocaleFechas, useT } from "../../i18n";

// CRUD por la API propia y no por la del Content Manager: el content-type está
// oculto ahí a propósito (editarlo a mano rompe cosas), y esa marca hace que
// /content-manager/collection-types/... devuelva 403 hasta al super admin.
const LIST_API = "/api/rss-feed/admin-list";
const CREATE_API = "/api/rss-feed/admin-create";
const UPDATE_API = "/api/rss-feed/admin-update";
const DELETE_API = "/api/rss-feed/admin-delete";
const FETCH_NOW_API = "/api/rss-feed/fetch-now";
const STATUS_API = "/api/rss-feed/admin-status";

type RssFeed = {
  id: number;
  documentId: string;
  name: string;
  url: string;
  enabled: boolean;
  /** Último fetch EXITOSO. Si el feed falla, deja de avanzar (esa es la señal). */
  lastFetchedAt: string | null;
  /** Error del último intento; null si salió bien. */
  lastError: string | null;
  /** Items dentro de la ventana de ingesta en el último fetch exitoso. */
  lastItemCount: number | null;
};

/** Cadencia del cron, servida por el backend para no hardcodearla en la página. */
type IngestStatus = {
  cronEnabled: boolean;
  rule: string | null;
  lastRunAt: string | null;
};

type FormData = {
  name: string;
  url: string;
  enabled: boolean;
};

const EMPTY_FORM: FormData = { name: "", url: "", enabled: true };

function feedToForm(feed: RssFeed): FormData {
  return { name: feed.name, url: feed.url, enabled: feed.enabled };
}

type T = ReturnType<typeof useT>;

function formatDate(iso: string | null, t: T, loc: string): string {
  if (!iso) return t("rss.nunca");
  return new Date(iso).toLocaleString(loc, {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Misma escala que AuditPage: la fecha exacta arriba y el "hace X" abajo, que
// es lo que se lee de un vistazo para detectar un feed que dejó de traer nada.
/**
 * La regla del cron, en palabras. Vivía en el servidor y llegaba armada en
 * castellano ("cada 30 minutos"); acá se traduce con el idioma del panel. Sólo
 * cubre los patrones de config/cron-tasks.ts: cualquier otra regla se muestra
 * cruda en vez de inventarle una lectura.
 */
function describirRegla(rule: string, t: T): string {
  const cadaN = rule.match(/^\*\/(\d+) \* \* \* \*$/);
  if (cadaN) return t("rss.cron.cadaN", { n: Number(cadaN[1]) });
  if (rule === "* * * * *") return t("rss.cron.cadaMinuto");
  const diaria = rule.match(/^(\d+) (\d+) \* \* \*$/);
  if (diaria) {
    return t("rss.cron.diaria", { hora: `${diaria[2].padStart(2, "0")}:${diaria[1].padStart(2, "0")}` });
  }
  return rule;
}

function relativeTime(iso: string | null, t: T): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return t("audit.hace", { cuanto: `${sec}s` });
  const min = Math.round(sec / 60);
  if (min < 60) return t("audit.hace", { cuanto: `${min}m` });
  const hr = Math.round(min / 60);
  if (hr < 24) return t("audit.hace", { cuanto: `${hr}h` });
  const days = Math.round(hr / 24);
  if (days < 7) return t("audit.hace", { cuanto: `${days}d` });
  return t("rss.haceSemanas", { n: Math.round(days / 7) });
}

/** Recorta la URL a lo informativo: dominio + path, sin esquema ni www. */
function prettyUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Feed form modal
// ---------------------------------------------------------------------------
type ValidationState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "invalid"; error: string }
  | {
      status: "valid";
      feedTitle: string;
      feedLink: string | null;
      language: string | null;
      totalItems: number;
      freshItems: number;
      samples: Array<{ title: string; url: string; pubDate: string | null }>;
    };

function FeedFormModal({
  open,
  onClose,
  onSaved,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial: { feed: RssFeed | null };
}) {
  const t = useT();
  const { post, put } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [form, setForm] = React.useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [validation, setValidation] = React.useState<ValidationState>({ status: "idle" });

  React.useEffect(() => {
    if (open) {
      setForm(initial.feed ? feedToForm(initial.feed) : EMPTY_FORM);
      setValidation({ status: "idle" });
    }
  }, [open, initial.feed]);

  const set = (key: keyof FormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Reset validation when URL changes
    if (key === "url") setValidation({ status: "idle" });
  };

  const handleValidate = async () => {
    if (!form.url.trim()) {
      toggleNotification({ type: "warning", message: t("rss.err.sinUrl") });
      return;
    }
    setValidation({ status: "testing" });
    try {
      const { data } = await post<{
        valid: boolean;
        error?: string;
        feedTitle?: string;
        feedLink?: string | null;
        language?: string | null;
        totalItems?: number;
        freshItems?: number;
        samples?: Array<{ title: string; url: string; pubDate: string | null }>;
      }>("/api/rss-feed/validate", { url: form.url.trim() });

      if (data.valid) {
        setValidation({
          status: "valid",
          feedTitle: data.feedTitle ?? t("rss.sinTitulo"),
          feedLink: data.feedLink ?? null,
          language: data.language ?? null,
          totalItems: data.totalItems ?? 0,
          freshItems: data.freshItems ?? 0,
          samples: data.samples ?? [],
        });
        // Auto-populate name field if empty using the feed title
        if (!form.name.trim() && data.feedTitle) {
          setForm((prev) => ({ ...prev, name: data.feedTitle! }));
        }
      } else {
        setValidation({ status: "invalid", error: data.error ?? t("rss.invalido") });
      }
    } catch (err) {
      setValidation({
        status: "invalid",
        error: err instanceof Error ? err.message : t("rss.err.endpoint"),
      });
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toggleNotification({ type: "warning", message: t("rss.err.obligatorios") });
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), url: form.url.trim(), enabled: form.enabled };
      if (initial.feed) {
        await put(`${UPDATE_API}/${initial.feed.documentId}`, payload);
      } else {
        await post(CREATE_API, payload);
      }
      toggleNotification({ type: "success", message: t("rss.ok.guardado") });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : t("rss.err.guardar");
      toggleNotification({ type: "danger", message: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Typography variant="omega" fontWeight="bold">
            {initial.feed ? t("rss.editarFeed") : t("rss.nuevoFeed")}
          </Typography>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root required>
              <Field.Label>{t("rss.nombre")}</Field.Label>
              <TextInput
                placeholder={t("rss.nombre.placeholder")}
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value)}
              />
            </Field.Root>
            <Field.Root required hint={t("rss.url.hint")}>
              <Field.Label>{t("rss.url.label")}</Field.Label>
              <Flex gap={2} alignItems="flex-start">
                <Box style={{ flex: 1 }}>
                  <TextInput
                    placeholder="https://example.com/feed/"
                    value={form.url}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      set("url", e.target.value)
                    }
                  />
                </Box>
                <Button
                  variant="tertiary"
                  size="S"
                  loading={validation.status === "testing"}
                  onClick={handleValidate}
                  disabled={!form.url.trim()}
                >{t("comun.verificar")}</Button>
              </Flex>
              <Field.Hint />
            </Field.Root>

            {/* Validation result panel */}
            {validation.status === "invalid" && (
              <Box
                padding={3}
                background="danger100"
                borderColor="danger600"
                borderWidth="1px"
                borderStyle="solid"
                hasRadius
              >
                <Typography variant="pi" textColor="danger700" fontWeight="bold">{t("rss.check.mal")}</Typography>
                <Box marginTop={1}>
                  <Typography variant="pi" textColor="danger700">
                    {validation.error}
                  </Typography>
                </Box>
              </Box>
            )}

            {validation.status === "valid" && (
              <Box
                padding={3}
                background="success100"
                borderColor="success600"
                borderWidth="1px"
                borderStyle="solid"
                hasRadius
              >
                <Typography variant="pi" textColor="success700" fontWeight="bold">{t("rss.check.bien")}</Typography>
                <Box marginTop={2}>
                  <Typography variant="pi" textColor="neutral800" fontWeight="bold">
                    {validation.feedTitle}
                  </Typography>
                  <Box marginTop={1}>
                    <Typography variant="pi" textColor="neutral600">
                      {validation.totalItems} items en total · {validation.freshItems} de las
                      últimas 24h
                      {validation.language ? ` · idioma: ${validation.language}` : ""}
                    </Typography>
                  </Box>
                </Box>
                <Box marginTop={3}>
                  <Typography variant="pi" textColor="neutral600" fontWeight="bold">{t("rss.ultimos5")}</Typography>
                  <Box marginTop={1}>
                    {validation.samples.map((s, i) => (
                      <Box key={i} marginTop={1}>
                        <Typography variant="pi" textColor="neutral800">
                          • {s.title.slice(0, 100)}
                          {s.title.length > 100 ? "…" : ""}
                        </Typography>
                        {s.pubDate && (
                          <Box marginLeft={2}>
                            <Typography variant="pi" textColor="neutral500">
                              {new Date(s.pubDate).toLocaleString("es-AR")}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}

            <Flex justifyContent="space-between" alignItems="center">
              <Typography variant="delta">{t("comun.habilitado")}</Typography>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v: boolean) => set("enabled", v)}
                aria-label={t("rss.habilitar")}
              />
            </Flex>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">{t("comun.cancelar")}</Button>
          </Modal.Close>
          <Button onClick={handleSave} loading={saving}>{t("comun.guardar")}</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}

// ---------------------------------------------------------------------------
// Feed row
// ---------------------------------------------------------------------------
function FeedRow({
  feed,
  onEdit,
  onDelete,
  onFetchNow,
  fetching,
}: {
  feed: RssFeed;
  onEdit: () => void;
  onDelete: () => void;
  onFetchNow: () => void;
  fetching: boolean;
}) {
  const t = useT();
  const loc = useLocaleFechas();
  const relative = relativeTime(feed.lastFetchedAt, t);
  // Dos dimensiones distintas: "Inactivo" es una decisión (alguien lo apagó),
  // "Error" es un síntoma (está prendido pero no responde). Mezclarlas en un
  // solo booleano era justamente lo que ocultaba a los feeds muertos.
  const failing = feed.enabled && Boolean(feed.lastError);

  return (
    <Tr>
      <Td>
        <Badge
          backgroundColor={!feed.enabled ? "neutral150" : failing ? "danger100" : "success100"}
          textColor={!feed.enabled ? "neutral600" : failing ? "danger700" : "success700"}
        >
          {!feed.enabled ? t("ag.inactivo") : failing ? t("audit.acc.error") : t("ag.activo")}
        </Badge>
      </Td>
      <Td>
        <Box style={{ maxWidth: 320 }}>
          <Typography
            variant="omega"
            fontWeight="bold"
            textColor={feed.enabled ? "neutral800" : "neutral600"}
            title={feed.name}
            ellipsis
          >
            {feed.name}
          </Typography>
          {/* El error va visible y no sólo en un tooltip: si hay que hacer hover
              para enterarse de que un feed está caído, nadie se entera. */}
          {failing ? (
            <Typography variant="pi" textColor="danger600" title={feed.lastError ?? ""} ellipsis>
              {feed.lastError}
            </Typography>
          ) : null}
        </Box>
      </Td>
      <Td>
        {/* La URL cruda ocupaba dos renglones y no se leía. Se muestra el
            dominio + path y la completa queda en el title y en el href. */}
        <Box style={{ maxWidth: 360 }}>
          <a
            href={feed.url}
            target="_blank"
            rel="noreferrer"
            title={feed.url}
            style={{ color: "inherit", textDecoration: "none" }}
          >
            <Typography variant="pi" textColor="primary600" ellipsis>
              {prettyUrl(feed.url)}
            </Typography>
          </a>
        </Box>
      </Td>
      <Td>
        <Typography variant="pi" textColor={feed.lastItemCount == null ? "neutral400" : "neutral800"}>
          {feed.lastItemCount == null ? "—" : feed.lastItemCount}
        </Typography>
      </Td>
      <Td>
        <Box>
          <Typography variant="pi" textColor={failing ? "danger600" : "neutral800"}>
            {formatDate(feed.lastFetchedAt, t, loc)}
          </Typography>
        </Box>
        {relative ? (
          <Box>
            <Typography variant="pi" textColor={failing ? "danger600" : "neutral500"}>
              {failing ? t("rss.sinActualizar", { cuando: relative }) : relative}
            </Typography>
          </Box>
        ) : null}
      </Td>
      <Td>
        <Flex gap={1}>
          <IconButton
            label={fetching ? t("rss.fetcheando") : t("rss.fetchAhora")}
            variant="ghost"
            onClick={onFetchNow}
            disabled={fetching}
          >
            <Play />
          </IconButton>
          <IconButton label={t("comun.editar")} variant="ghost" onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton label={t("comun.eliminar")} variant="ghost" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Flex>
      </Td>
    </Tr>
  );
}

// Tarjeta apilada para mobile: la tabla de 6 columnas no entra en un celular
// (sólo se veían Estado + Nombre y las acciones quedaban fuera de pantalla).
function FeedCard({
  feed,
  onEdit,
  onDelete,
  onFetchNow,
  fetching,
}: {
  feed: RssFeed;
  onEdit: () => void;
  onDelete: () => void;
  onFetchNow: () => void;
  fetching: boolean;
}) {
  const t = useT();
  const loc = useLocaleFechas();
  const relative = relativeTime(feed.lastFetchedAt, t);
  const failing = feed.enabled && Boolean(feed.lastError);
  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      hasRadius
      padding={3}
      shadow="tableShadow"
    >
      <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Typography
          variant="omega"
          fontWeight="bold"
          textColor={feed.enabled ? "neutral800" : "neutral600"}
          style={{ minWidth: 0, overflowWrap: "anywhere" }}
        >
          {feed.name}
        </Typography>
        <Badge
          backgroundColor={!feed.enabled ? "neutral150" : failing ? "danger100" : "success100"}
          textColor={!feed.enabled ? "neutral600" : failing ? "danger700" : "success700"}
        >
          {!feed.enabled ? t("ag.inactivo") : failing ? t("audit.acc.error") : t("ag.activo")}
        </Badge>
      </Flex>

      {failing ? (
        <Box marginTop={1}>
          <Typography variant="pi" textColor="danger600" style={{ overflowWrap: "anywhere" }}>
            {feed.lastError}
          </Typography>
        </Box>
      ) : null}

      <Box marginTop={2}>
        <a href={feed.url} target="_blank" rel="noreferrer" title={feed.url} style={{ color: "inherit", textDecoration: "none" }}>
          <Typography variant="pi" textColor="primary600" style={{ overflowWrap: "anywhere" }}>
            {prettyUrl(feed.url)}
          </Typography>
        </a>
      </Box>

      <Flex gap={2} wrap="wrap" marginTop={2}>
        <Typography variant="pi" textColor="neutral600">
          {t("rss.nItems", { n: feed.lastItemCount == null ? "—" : feed.lastItemCount })}
        </Typography>
        <Typography variant="pi" textColor={failing ? "danger600" : "neutral500"}>
          · {formatDate(feed.lastFetchedAt, t, loc)}
          {relative ? ` (${failing ? t("rss.sinActualizar", { cuando: relative }) : relative})` : ""}
        </Typography>
      </Flex>

      <Flex gap={1} marginTop={3}>
        <IconButton label={fetching ? t("rss.fetcheando") : t("rss.fetchAhora")} variant="ghost" onClick={onFetchNow} disabled={fetching}>
          <Play />
        </IconButton>
        <IconButton label={t("comun.editar")} variant="ghost" onClick={onEdit}>
          <Pencil />
        </IconButton>
        <IconButton label={t("comun.eliminar")} variant="ghost" onClick={onDelete}>
          <Trash />
        </IconButton>
      </Flex>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RssFeedsPage() {
  const t = useT();
  const { get, post, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [feeds, setFeeds] = React.useState<RssFeed[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [discoverOpen, setDiscoverOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RssFeed | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RssFeed | null>(null);
  const [fetchingId, setFetchingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<IngestStatus | null>(null);
  const isMobile = useIsMobile();

  const failingCount = feeds.filter((f) => f.enabled && f.lastError).length;

  const loadFeeds = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await get(LIST_API);
      setFeeds((data as { results: RssFeed[] }).results ?? []);
    } catch {
      toggleNotification({ type: "danger", message: t("rss.err.cargar") });
    } finally {
      setLoading(false);
    }
    // La cadencia es informativa: si el endpoint falla se omite la línea en vez
    // de romper la página o molestar con una notificación.
    try {
      const { data } = await get(STATUS_API);
      setStatus(data as IngestStatus);
    } catch {
      setStatus(null);
    }
  }, [get, toggleNotification]);

  React.useEffect(() => { loadFeeds(); }, [loadFeeds]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del(`${DELETE_API}/${deleteTarget.documentId}`);
      toggleNotification({ type: "success", message: t("rss.ok.eliminado") });
      setDeleteTarget(null);
      loadFeeds();
    } catch {
      toggleNotification({ type: "danger", message: t("rss.err.eliminar") });
    }
  };

  const handleFetchNow = async (feed: RssFeed) => {
    setFetchingId(feed.documentId);
    try {
      await post(FETCH_NOW_API, { documentId: feed.documentId });
      toggleNotification({ type: "success", message: t("rss.ok.fetch", { nombre: feed.name }) });
      loadFeeds();
    } catch {
      toggleNotification({ type: "danger", message: t("rss.err.fetch", { nombre: feed.name }) });
    } finally {
      setFetchingId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Globe width="1.4rem" height="1.4rem" />}
        title={t("rss.titulo")}
        subtitle={t("rss.subtitulo")}
        actions={
          <Flex gap={2}>
            {/* Buscar va primero: agregar a mano exige saber de antemano la URL
                del feed, que es justamente lo que casi nunca se sabe. */}
            <Button
              variant="secondary"
              startIcon={<Search />}
              onClick={() => setDiscoverOpen(true)}
            >{t("rss.buscarFuentes")}</Button>
            <Button
              startIcon={<Plus />}
              onClick={() => { setEditing(null); setModalOpen(true); }}
            >{t("rss.agregarFeed")}</Button>
          </Flex>
        }
      />

      {/* Content */}
      {loading ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>{t("rss.cargando")}</Loader>
        </Flex>
      ) : feeds.length === 0 ? (
        <EmptyState
          icon={<Globe />}
          title={t("rss.vacio")}
          action={
            <Flex gap={2}>
              <Button
                startIcon={<Search />}
                onClick={() => setDiscoverOpen(true)}
              >
                {t("rss.buscarFuentes")}
              </Button>
              <Button
                variant="secondary"
                startIcon={<Plus />}
                onClick={() => { setEditing(null); setModalOpen(true); }}
              >{t("rss.pegarUrl")}</Button>
            </Flex>
          }
        />
      ) : (
        <>
          <Flex marginBottom={2} gap={1} wrap="wrap" alignItems="center">
            <Typography variant="pi" textColor="neutral600">
              {t("rss.resumenFuentes", {
                n: feeds.length,
                activas: feeds.filter((f) => f.enabled).length,
              })}
            </Typography>
            {failingCount > 0 ? (
              <Typography variant="pi" textColor="danger600" fontWeight="bold">
                · {t("rss.conError", { n: failingCount })}
              </Typography>
            ) : null}
            {/* La cadencia sale del backend (regla real del cron), no de una
                constante acá: si cambia cron-tasks.ts, esto acompaña solo. */}
            {status ? (
              <Typography variant="pi" textColor={status.cronEnabled ? "neutral600" : "danger600"}>
                {status.cronEnabled
                  ? `· ${t("rss.ingestaAuto", {
                      cuando: status.rule ? describirRegla(status.rule, t) : t("rss.programada"),
                    })}${
                      status.lastRunAt
                        ? ` · ${t("rss.ultimaCorrida", { cuando: relativeTime(status.lastRunAt, t) ?? "" })}`
                        : " " + t("rss.sinCorridas")
                    }`
                  : t("rss.cronOff")}
              </Typography>
            ) : null}
          </Flex>
          {isMobile ? (
            <Flex direction="column" alignItems="stretch" gap={2}>
              {feeds.map((feed) => (
                <FeedCard
                  key={feed.documentId}
                  feed={feed}
                  onEdit={() => { setEditing(feed); setModalOpen(true); }}
                  onDelete={() => setDeleteTarget(feed)}
                  onFetchNow={() => handleFetchNow(feed)}
                  fetching={fetchingId === feed.documentId}
                />
              ))}
            </Flex>
          ) : (
            <Box background="neutral0" hasRadius shadow="tableShadow">
              <Table colCount={6} rowCount={feeds.length}>
                <Thead>
                  <Tr>
                    <Th>
                      <Typography variant="sigma">{t("rss.col.estado")}</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">{t("rss.col.nombre")}</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">{t("rss.col.url")}</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">{t("rss.col.items")}</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">{t("rss.ultimoFetch")}</Typography>
                    </Th>
                    <Th>
                      <Typography variant="sigma">{t("rss.col.acciones")}</Typography>
                    </Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {feeds.map((feed) => (
                    <FeedRow
                      key={feed.documentId}
                      feed={feed}
                      onEdit={() => { setEditing(feed); setModalOpen(true); }}
                      onDelete={() => setDeleteTarget(feed)}
                      onFetchNow={() => handleFetchNow(feed)}
                      fetching={fetchingId === feed.documentId}
                    />
                  ))}
                </Tbody>
              </Table>
            </Box>
          )}
        </>
      )}

      {/* Buscador de fuentes */}
      <DiscoverModal
        open={discoverOpen}
        onClose={() => setDiscoverOpen(false)}
        onAdded={loadFeeds}
      />

      {/* Form modal */}
      <FeedFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={loadFeeds}
        initial={{ feed: editing }}
      />

      {/* Delete confirmation */}
      <Dialog.Root
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <Dialog.Content>
          <Dialog.Header>{t("rss.eliminarFeed")}</Dialog.Header>
          <Dialog.Body>
            <Typography>
              {t("rss.borrar.pregunta", { nombre: deleteTarget?.name ?? "" })}
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">{t("comun.cancelar")}</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger" onClick={handleDelete}>{t("comun.eliminar")}</Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </PageContainer>
  );
}
