import * as React from "react";
import { Box, Flex, Typography, Badge, Divider, Button } from "@strapi/design-system";
import { Widget, useFetchClient, useNotification } from "@strapi/strapi/admin";
import { useUncapHeight } from "./useUncapHeight";

type CronInfo = { enabled: boolean; rule: string | null; label: string | null; tz: string | null };
type Item = {
  titulo: string;
  norma: string | null;
  url: string;
  rubro: string | null;
  publicadaEl: string | null;
  relevancia: number | null;
  relevanciaMotivo: string | null;
  resumen: string | null;
  analisisEstado: "pendiente" | "listo" | "descartada" | "error";
};
type BoletinData = {
  cron: CronInfo;
  terms: string[];
  sinceDays: number;
  total: number;
  estados: { listas: number; descartadas: number; pendientes: number; errores: number };
  items: Item[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Cómo se ve cada estado del análisis. El color es la señal, no el texto. */
const ESTADO: Record<Item["analisisEstado"], { label: string; bg: string; fg: string }> = {
  listo: { label: "publicada", bg: "success100", fg: "success600" },
  descartada: { label: "descartada", bg: "neutral150", fg: "neutral600" },
  pendiente: { label: "sin analizar", bg: "warning100", fg: "warning600" },
  error: { label: "error", bg: "danger100", fg: "danger600" },
};

export default function BoletinWidget() {
  useUncapHeight();
  const { get, post } = useFetchClient();
  const { toggleNotification } = useNotification();
  const [data, setData] = React.useState<BoletinData | null>(null);
  const [error, setError] = React.useState(false);
  const [running, setRunning] = React.useState<null | "sync" | "reanalizar">(null);

  const load = React.useCallback(() => {
    return get("/api/dashboard/boletin")
      .then((res: { data: BoletinData }) => setData(res.data))
      .catch(() => setError(true));
  }, [get]);

  React.useEffect(() => {
    load();
  }, [load]);

  // El sync manual habla con el Boletín y después con OpenAI norma por norma:
  // con varias pendientes tarda minutos. Por eso el botón queda deshabilitado
  // y se recarga recién al terminar, en vez de hacer polling.
  const run = async (action: "sync" | "reanalizar") => {
    setRunning(action);
    try {
      const path = action === "sync" ? "/api/boletin/sync" : "/api/boletin/reanalizar";
      const res = await post(path, {});
      const d = res.data as { nuevas?: number; analizadas?: number; encoladas?: number };
      toggleNotification({
        type: "success",
        message:
          action === "sync"
            ? `${d.nuevas ?? 0} normas nuevas, ${d.analizadas ?? 0} analizadas.`
            : `${d.encoladas ?? 0} normas encoladas para re-analizar.`,
      });
      await load();
    } catch (err) {
      toggleNotification({ type: "danger", message: `No se pudo completar: ${err}` });
    } finally {
      setRunning(null);
    }
  };

  if (error) return <Widget.Error />;
  if (!data) return <Widget.Loading />;

  return (
    <Flex className="codelo-widget-body" direction="column" alignItems="stretch" gap={3}>
      <Typography variant="pi" textColor="neutral600">
        Cada día el sistema busca en el Boletín Oficial normas nuevas que mencionen los temas de la
        asociación, guarda su texto íntegro y lo hace leer por IA: un puntaje de relevancia que
        descarta el ruido y una ficha con qué cambia y a quién afecta. Las relevantes se publican en
        /normativa y se le pasan al Redactor.
      </Typography>

      <Flex gap={2} wrap="wrap" alignItems="center">
        <Badge>{data.cron.enabled ? (data.cron.label ?? "programado") : "cron desactivado"}</Badge>
        <Typography variant="pi" textColor="neutral500">
          barre los últimos {data.sinceDays} días · {data.total} normas archivadas
        </Typography>
      </Flex>

      <Flex gap={2} wrap="wrap" alignItems="center">
        <Badge backgroundColor="success100" textColor="success600">
          {data.estados.listas} publicadas
        </Badge>
        <Badge backgroundColor="neutral150" textColor="neutral600">
          {data.estados.descartadas} descartadas
        </Badge>
        {data.estados.pendientes > 0 ? (
          <Badge backgroundColor="warning100" textColor="warning600">
            {data.estados.pendientes} sin analizar
          </Badge>
        ) : null}
        {data.estados.errores > 0 ? (
          <Badge backgroundColor="danger100" textColor="danger600">
            {data.estados.errores} con error
          </Badge>
        ) : null}
      </Flex>

      <Flex gap={2} wrap="wrap">
        <Button size="S" variant="secondary" loading={running === "sync"} disabled={running !== null} onClick={() => run("sync")}>
          Sincronizar ahora
        </Button>
        <Button
          size="S"
          variant="tertiary"
          loading={running === "reanalizar"}
          disabled={running !== null}
          onClick={() => run("reanalizar")}
        >
          Re-analizar descartadas
        </Button>
      </Flex>
      <Typography variant="pi" textColor="neutral500">
        Re-analizar no vuelve a tocar el Boletín: el texto ya está archivado. Es lo que hay que
        correr después de cambiar la escala de relevancia en Prompts.
      </Typography>

      <Divider />

      <Box>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Últimas normas capturadas
        </Typography>
        {data.items.length === 0 ? (
          <Box marginTop={1}>
            <Typography variant="pi" textColor="neutral500">
              Todavía no se archivó ninguna norma. Es normal en un entorno nuevo: usá “Sincronizar
              ahora” para no esperar al cron.
            </Typography>
          </Box>
        ) : (
          <Flex direction="column" alignItems="stretch" gap={3} marginTop={2}>
            {data.items.slice(0, 5).map((it) => {
              const estado = ESTADO[it.analisisEstado] ?? ESTADO.pendiente;
              return (
                <Box key={it.url}>
                  {/* Sin ellipsis: el título envuelve a varias líneas en vez de
                      empujar el ancho y disparar scroll horizontal. */}
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none", overflowWrap: "anywhere" }}
                  >
                    <Typography variant="pi" textColor="primary600">
                      {it.norma ? `${it.norma} — ${it.titulo}` : it.titulo}
                    </Typography>
                  </a>
                  <Flex gap={2} alignItems="center" wrap="wrap" marginTop={1}>
                    <Badge backgroundColor={estado.bg} textColor={estado.fg}>
                      {estado.label}
                      {it.relevancia !== null ? ` · ${it.relevancia}/3` : ""}
                    </Badge>
                    {it.rubro ? (
                      <Typography variant="pi" textColor="neutral500">
                        {it.rubro.toLowerCase()}
                      </Typography>
                    ) : null}
                    {it.publicadaEl ? (
                      <Typography variant="pi" textColor="neutral400">
                        · {fmtDate(it.publicadaEl)}
                      </Typography>
                    ) : null}
                  </Flex>
                  {/* El resumen si la norma se publica; si se descartó, el motivo
                      — que es lo que hace falta para calibrar la escala. */}
                  <Box marginTop={1}>
                    <Typography variant="pi" textColor="neutral600">
                      {it.analisisEstado === "listo"
                        ? it.resumen
                        : it.analisisEstado === "descartada"
                          ? it.relevanciaMotivo
                          : null}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
