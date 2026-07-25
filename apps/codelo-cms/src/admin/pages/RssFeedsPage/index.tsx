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
import { Plus, Pencil, Trash, Play, Globe } from "@strapi/icons";
import {
  useFetchClient,
  useNotification,
} from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState } from "../../components/ui";

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
  label: string | null;
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

function formatDate(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Misma escala que AuditPage: la fecha exacta arriba y el "hace X" abajo, que
// es lo que se lee de un vistazo para detectar un feed que dejó de traer nada.
function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `hace ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `hace ${hr}h`;
  const days = Math.round(hr / 24);
  if (days < 7) return `hace ${days}d`;
  return `hace ${Math.round(days / 7)} sem`;
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
      toggleNotification({ type: "warning", message: "Ingresá una URL antes de verificar." });
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
          feedTitle: data.feedTitle ?? "(sin título)",
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
        setValidation({ status: "invalid", error: data.error ?? "Feed inválido" });
      }
    } catch (err) {
      setValidation({
        status: "invalid",
        error: err instanceof Error ? err.message : "Error al contactar el endpoint",
      });
    }
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.url.trim()) {
      toggleNotification({ type: "warning", message: "Nombre y URL son obligatorios." });
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
      toggleNotification({ type: "success", message: "Feed guardado." });
      onSaved();
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Error desconocido al guardar el feed.";
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
            {initial.feed ? "Editar feed RSS" : "Nuevo feed RSS"}
          </Typography>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root required>
              <Field.Label>Nombre</Field.Label>
              <TextInput
                placeholder="Ej: Boletín Oficial — Salud"
                value={form.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value)}
              />
            </Field.Root>
            <Field.Root required hint="URL pública del feed RSS (formato XML).">
              <Field.Label>URL del feed</Field.Label>
              <Flex gap={2} alignItems="flex-start">
                <Box style={{ flex: 1 }}>
                  <TextInput
                    placeholder="https://www.thclab.com.ar/feed/"
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
                >
                  Verificar
                </Button>
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
                <Typography variant="pi" textColor="danger700" fontWeight="bold">
                  ✗ Feed inválido
                </Typography>
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
                <Typography variant="pi" textColor="success700" fontWeight="bold">
                  ✓ Feed válido
                </Typography>
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
                  <Typography variant="pi" textColor="neutral600" fontWeight="bold">
                    Últimos 5 títulos:
                  </Typography>
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
              <Typography variant="delta">Habilitado</Typography>
              <Switch
                checked={form.enabled}
                onCheckedChange={(v: boolean) => set("enabled", v)}
                aria-label="Habilitar feed"
              />
            </Flex>
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close>
            <Button variant="tertiary">Cancelar</Button>
          </Modal.Close>
          <Button onClick={handleSave} loading={saving}>
            Guardar
          </Button>
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
  const relative = relativeTime(feed.lastFetchedAt);
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
          {!feed.enabled ? "Inactivo" : failing ? "Error" : "Activo"}
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
            {formatDate(feed.lastFetchedAt)}
          </Typography>
        </Box>
        {relative ? (
          <Box>
            <Typography variant="pi" textColor={failing ? "danger600" : "neutral500"}>
              {failing ? `${relative} · sin actualizar` : relative}
            </Typography>
          </Box>
        ) : null}
      </Td>
      <Td>
        <Flex gap={1}>
          <IconButton
            label={fetching ? "Fetcheando…" : "Fetch ahora"}
            variant="ghost"
            onClick={onFetchNow}
            disabled={fetching}
          >
            <Play />
          </IconButton>
          <IconButton label="Editar" variant="ghost" onClick={onEdit}>
            <Pencil />
          </IconButton>
          <IconButton label="Eliminar" variant="ghost" onClick={onDelete}>
            <Trash />
          </IconButton>
        </Flex>
      </Td>
    </Tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function RssFeedsPage() {
  const { get, post, del } = useFetchClient();
  const { toggleNotification } = useNotification();

  const [feeds, setFeeds] = React.useState<RssFeed[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RssFeed | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<RssFeed | null>(null);
  const [fetchingId, setFetchingId] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<IngestStatus | null>(null);

  const failingCount = feeds.filter((f) => f.enabled && f.lastError).length;

  const loadFeeds = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await get(LIST_API);
      setFeeds((data as { results: RssFeed[] }).results ?? []);
    } catch {
      toggleNotification({ type: "danger", message: "Error al cargar los feeds." });
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
      toggleNotification({ type: "success", message: "Feed eliminado." });
      setDeleteTarget(null);
      loadFeeds();
    } catch {
      toggleNotification({ type: "danger", message: "Error al eliminar el feed." });
    }
  };

  const handleFetchNow = async (feed: RssFeed) => {
    setFetchingId(feed.documentId);
    try {
      await post(FETCH_NOW_API, { documentId: feed.documentId });
      toggleNotification({ type: "success", message: `Feed "${feed.name}" fetcheado correctamente.` });
      loadFeeds();
    } catch {
      toggleNotification({ type: "danger", message: `Error al fetchear "${feed.name}".` });
    } finally {
      setFetchingId(null);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        icon={<Globe width="1.4rem" height="1.4rem" />}
        title="Fuentes RSS"
        subtitle="Gestioná las fuentes de noticias que alimentan la base de conocimiento diaria de los agentes."
        actions={
          <Button
            startIcon={<Plus />}
            onClick={() => { setEditing(null); setModalOpen(true); }}
          >
            Agregar feed
          </Button>
        }
      />

      {/* Content */}
      {loading ? (
        <Flex justifyContent="center" padding={8}>
          <Loader>Cargando feeds…</Loader>
        </Flex>
      ) : feeds.length === 0 ? (
        <EmptyState
          icon={<Globe />}
          title="No hay feeds configurados. Agregá una fuente RSS para empezar."
          action={
            <Button
              variant="secondary"
              startIcon={<Plus />}
              onClick={() => { setEditing(null); setModalOpen(true); }}
            >
              Agregar primer feed
            </Button>
          }
        />
      ) : (
        <>
          <Flex marginBottom={2} gap={1} wrap="wrap" alignItems="center">
            <Typography variant="pi" textColor="neutral600">
              {feeds.length} {feeds.length === 1 ? "fuente" : "fuentes"} ·{" "}
              {feeds.filter((f) => f.enabled).length} activas
            </Typography>
            {failingCount > 0 ? (
              <Typography variant="pi" textColor="danger600" fontWeight="bold">
                · {failingCount} con error
              </Typography>
            ) : null}
            {/* La cadencia sale del backend (regla real del cron), no de una
                constante acá: si cambia cron-tasks.ts, esto acompaña solo. */}
            {status ? (
              <Typography variant="pi" textColor={status.cronEnabled ? "neutral600" : "danger600"}>
                {status.cronEnabled
                  ? `· ingesta automática ${status.label ?? "programada"}${
                      status.lastRunAt
                        ? ` · última corrida ${relativeTime(status.lastRunAt)}`
                        : " · sin corridas todavía"
                    }`
                  : "· ingesta automática DESACTIVADA (CRON_ENABLED=false)"}
              </Typography>
            ) : null}
          </Flex>
          <Box background="neutral0" hasRadius shadow="tableShadow">
            <Table colCount={6} rowCount={feeds.length}>
              <Thead>
                <Tr>
                  <Th>
                    <Typography variant="sigma">Estado</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Nombre</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">URL</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Items</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Último fetch OK</Typography>
                  </Th>
                  <Th>
                    <Typography variant="sigma">Acciones</Typography>
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
        </>
      )}

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
          <Dialog.Header>Eliminar feed</Dialog.Header>
          <Dialog.Body>
            <Typography>
              ¿Eliminás el feed <strong>{deleteTarget?.name}</strong>? Esta acción no se puede deshacer.
            </Typography>
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Cancel>
              <Button variant="tertiary">Cancelar</Button>
            </Dialog.Cancel>
            <Dialog.Action>
              <Button variant="danger" onClick={handleDelete}>
                Eliminar
              </Button>
            </Dialog.Action>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </PageContainer>
  );
}
