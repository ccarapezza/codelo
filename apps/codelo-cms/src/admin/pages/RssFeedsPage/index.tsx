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
} from "@strapi/design-system";
import { Plus, Pencil, Trash, Play, Globe } from "@strapi/icons";
import {
  useFetchClient,
  useNotification,
} from "@strapi/strapi/admin";
import { PageContainer, PageHeader, EmptyState, Hairline } from "../../components/ui";

const CM_API = "/content-manager/collection-types/api::rss-feed.rss-feed";
const FETCH_NOW_API = "/api/rss-feed/fetch-now";

type RssFeed = {
  id: number;
  documentId: string;
  name: string;
  url: string;
  enabled: boolean;
  lastFetchedAt: string | null;
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
        await put(`${CM_API}/${initial.feed.documentId}`, payload);
      } else {
        await post(CM_API, payload);
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
// Feed card
// ---------------------------------------------------------------------------
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
  return (
    <Box
      background="neutral0"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      hasRadius
      shadow="filterShadow"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Header */}
      <Box padding={4}>
        <Flex justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Flex gap={3} alignItems="center" style={{ minWidth: 0, flex: 1 }}>
            <Box
              background={feed.enabled ? "success100" : "neutral150"}
              borderRadius="4px"
              hasRadius
              style={{
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Typography textColor={feed.enabled ? "success600" : "neutral500"}>
                <Globe />
              </Typography>
            </Box>
            <Box style={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="omega"
                fontWeight="bold"
                textColor="neutral800"
                ellipsis
              >
                {feed.name}
              </Typography>
              <Box marginTop={1}>
                <Badge active={feed.enabled}>
                  {feed.enabled ? "Activo" : "Inactivo"}
                </Badge>
              </Box>
            </Box>
          </Flex>
          <Flex gap={1} alignItems="center" style={{ flexShrink: 0 }}>
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
        </Flex>
      </Box>

      <Hairline />

      {/* Body */}
      <Box padding={4} background="neutral100" style={{ flex: 1 }}>
        <Box>
          <Typography variant="pi" textColor="neutral500" fontWeight="bold">
            URL
          </Typography>
          <Box marginTop={1}>
            <Typography
              variant="pi"
              textColor="neutral700"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                wordBreak: "break-all",
              }}
            >
              {feed.url}
            </Typography>
          </Box>
        </Box>
        <Box marginTop={3}>
          <Typography variant="pi" textColor="neutral500" fontWeight="bold">
            Último fetch
          </Typography>
          <Box marginTop={1}>
            <Typography variant="pi" textColor="neutral700">
              {formatDate(feed.lastFetchedAt)}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
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

  const loadFeeds = React.useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await get(`${CM_API}?pageSize=100&sort=name:asc`);
      setFeeds((data as { results: RssFeed[] }).results ?? []);
    } catch {
      toggleNotification({ type: "danger", message: "Error al cargar los feeds." });
    } finally {
      setLoading(false);
    }
  }, [get, toggleNotification]);

  React.useEffect(() => { loadFeeds(); }, [loadFeeds]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await del(`${CM_API}/${deleteTarget.documentId}`);
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
        <Box
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 24,
            alignItems: "stretch",
          }}
        >
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
        </Box>
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
