// Buscador de fuentes RSS.
//
// La promesa de la pantalla es que TODO lo que se lista ya fue bajado y
// parseado por el backend: no hay URLs candidatas sin verificar. Por eso la
// búsqueda tarda —valida cada candidato en vivo— y por eso conviene avisarlo.

import React from "react";
import { EDICIONES } from "../../../lib/google-news";
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Loader,
  Modal,
  SingleSelect,
  SingleSelectOption,
  TextInput,
  Typography,
} from "@strapi/design-system";
import { Check, Plus, Search } from "@strapi/icons";
import { useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useLocaleFechas, useT } from "../../i18n";

const DISCOVER_API = "/api/rss-feed/discover";
const CREATE_API = "/api/rss-feed/admin-create";

type Discovered = {
  url: string;
  title: string;
  description: string | null;
  siteUrl: string | null;
  language: string | null;
  subscribers: number | null;
  velocity: number | null;
  totalItems: number | null;
  freshItems: number | null;
  samples: Array<{ title: string; url: string; pubDate: string | null }>;
  topicMatch: { matched: number; total: number; pct: number } | null;
  alreadyAdded: boolean;
  via: "feedly" | "autodiscovery" | "sonda";
};

const ORIGEN: Record<Discovered["via"], string> = {
  feedly: "directorio",
  autodiscovery: "rss.desc.declarado",
  sonda: "rss.desc.sondeado",
};

/** Verde sólo con evidencia fuerte: el color es una recomendación. */
function tonoDeMatch(pct: number): "success" | "warning" | "danger" {
  if (pct >= 60) return "success";
  if (pct >= 25) return "warning";
  return "danger";
}

function ritmo(f: Discovered, t: ReturnType<typeof useT>, dias: number): string | null {
  if (f.velocity != null) return t("rss.desc.ritmo", { n: f.velocity.toFixed(1) });
  if (f.freshItems != null) return t("rss.desc.frescos", { n: f.freshItems, dias });
  return null;
}

/**
 * El nombre del país en el idioma del panel, con `Intl.DisplayNames`: la lista
 * de ediciones trae los nombres en castellano y es la misma que usa el
 * servidor, así que no se traduce ahí.
 */
function nombrePais(code: string, loc: string): string {
  try {
    return new Intl.DisplayNames([loc], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function Resultado({
  feed,
  onAdded,
  dias,
}: {
  feed: Discovered;
  onAdded: () => void;
  /** La ventana de ingesta con la que el servidor contó los frescos. */
  dias: number;
}) {
  const t = useT();
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [guardando, setGuardando] = React.useState(false);
  const [agregado, setAgregado] = React.useState(feed.alreadyAdded);

  const agregar = async () => {
    setGuardando(true);
    try {
      await post(CREATE_API, { name: feed.title.slice(0, 120), url: feed.url, enabled: true });
      setAgregado(true);
      toggleNotification({ type: "success", message: t("rss.desc.agregado", { titulo: feed.title }) });
      onAdded();
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data
        ?.error?.message;
      toggleNotification({ type: "danger", message: msg || t("rss.desc.err") });
    } finally {
      setGuardando(false);
    }
  };

  const cadencia = ritmo(feed, t, dias);

  return (
    <Box padding={4} background="neutral0" hasRadius shadow="tableShadow">
      <Flex justifyContent="space-between" alignItems="flex-start" gap={3}>
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Typography variant="omega" fontWeight="bold" ellipsis>
            {feed.title}
          </Typography>
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral600" ellipsis>
              {feed.url}
            </Typography>
          </Box>
          {feed.description ? (
            <Box paddingTop={2}>
              <Typography variant="pi" textColor="neutral700">
                {feed.description.slice(0, 180)}
              </Typography>
            </Box>
          ) : null}

          <Flex gap={2} paddingTop={3} wrap="wrap">
            {feed.topicMatch ? (
              <Badge backgroundColor={`${tonoDeMatch(feed.topicMatch.pct)}100`}>
                {t("rss.desc.match", { pct: feed.topicMatch.pct })}
              </Badge>
            ) : null}
            {cadencia ? <Badge>{cadencia}</Badge> : null}
            {feed.language ? <Badge>{feed.language}</Badge> : null}
            <Badge>{t(ORIGEN[feed.via])}</Badge>
          </Flex>

          {feed.samples.length > 0 ? (
            <Box paddingTop={3}>
              <Typography variant="pi" textColor="neutral500">{t("rss.desc.ultimos")}</Typography>
              {feed.samples.map((s) => (
                <Box key={s.url} paddingTop={1}>
                  <Typography variant="pi" textColor="neutral600" ellipsis>
                    · {s.title}
                  </Typography>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>

        <Button
          size="S"
          variant={agregado ? "success-light" : "secondary"}
          disabled={agregado || guardando}
          loading={guardando}
          startIcon={agregado ? <Check /> : <Plus />}
          onClick={agregar}
        >
          {agregado ? t("rss.desc.yaEsta") : t("comun.agregar")}
        </Button>
      </Flex>
    </Box>
  );
}

export default function DiscoverModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const t = useT();
  const loc = useLocaleFechas();
  const { post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [query, setQuery] = React.useState("");
  // Los directorios son abrumadoramente anglosajones: un término de nicho sin
  // filtrar devuelve media docena de feeds en inglés y ninguno en castellano.
  // Para un sitio en español el filtro no es una comodidad, es la diferencia
  // entre que la herramienta sirva o no.
  const [lang, setLang] = React.useState<string>("");
  const [pais, setPais] = React.useState<string>("");
  const [buscando, setBuscando] = React.useState(false);
  const [resultado, setResultado] = React.useState<{
    feeds: Discovered[];
    query: string;
    windowDays?: number;
  } | null>(
    null,
  );

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setResultado(null);
    }
  }, [open]);

  const buscar = async () => {
    const q = query.trim();
    if (!q) return;
    setBuscando(true);
    setResultado(null);
    try {
      const { data } = await post<{ feeds: Discovered[]; query: string; windowDays?: number }>(DISCOVER_API, {
        query: q,
        lang: lang || null,
        country: pais || null,
      });
      setResultado(data);
    } catch {
      toggleNotification({ type: "danger", message: t("rss.desc.errBusqueda") });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <Modal.Root open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <Modal.Content style={{ maxWidth: "76rem", width: "90vw" }}>
        <Modal.Header>
          <Typography variant="omega" fontWeight="bold">{t("rss.desc.titulo")}</Typography>
        </Modal.Header>
        <Modal.Body>
          <Flex direction="column" alignItems="stretch" gap={4}>
            <Field.Root hint={t("rss.desc.hint")}>
              <Field.Label>{t("rss.desc.label")}</Field.Label>
              <Flex gap={2} alignItems="flex-start">
                <Box style={{ flex: 1 }}>
                  <TextInput
                    placeholder={t("rss.desc.placeholder")}
                    value={query}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === "Enter") buscar();
                    }}
                  />
                </Box>
                <Box style={{ width: "13rem" }}>
                  <SingleSelect
                    aria-label={t("rss.pais.label")}
                    value={pais}
                    onChange={(v: string) => setPais(v ?? "")}
                  >
                    <SingleSelectOption value="">{t("rss.pais.cualquiera")}</SingleSelectOption>
                    {EDICIONES.map((e) => (
                      <SingleSelectOption key={e.code} value={e.code}>
                        {nombrePais(e.code, loc)}
                        {e.hl.startsWith("en") ? ` ${t("rss.pais.enIngles")}` : ""}
                      </SingleSelectOption>
                    ))}
                  </SingleSelect>
                </Box>
                <Box style={{ width: "13rem" }}>
                  <SingleSelect
                    aria-label={t("rss.idioma.label")}
                    value={lang}
                    onChange={(v: string) => setLang(v ?? "")}
                  >
                    <SingleSelectOption value="">{t("rss.idioma.cualquiera")}</SingleSelectOption>
                    <SingleSelectOption value="es">{t("rss.idioma.es")}</SingleSelectOption>
                    <SingleSelectOption value="en">{t("rss.idioma.en")}</SingleSelectOption>
                    <SingleSelectOption value="pt">{t("rss.idioma.pt")}</SingleSelectOption>
                  </SingleSelect>
                </Box>
                <Button
                  startIcon={<Search />}
                  onClick={buscar}
                  loading={buscando}
                  disabled={!query.trim() || buscando}
                >{t("comun.buscar")}</Button>
              </Flex>
              <Field.Hint />
            </Field.Root>

            {buscando ? (
              <Flex justifyContent="center" padding={8}>
                <Loader>{t("rss.desc.bajando")}</Loader>
              </Flex>
            ) : null}

            {resultado && resultado.feeds.length === 0 ? (
              <Box padding={6} background="neutral100" hasRadius>
                <Typography textColor="neutral700">
                  {t("rss.desc.sinResultados", { query: resultado.query })}
                </Typography>
              </Box>
            ) : null}

            {resultado?.feeds.map((f) => (
              <Resultado key={f.url} feed={f} onAdded={onAdded} dias={resultado.windowDays ?? 7} />
            ))}
          </Flex>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="tertiary" onClick={onClose}>{t("comun.cerrar")}</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
  );
}
