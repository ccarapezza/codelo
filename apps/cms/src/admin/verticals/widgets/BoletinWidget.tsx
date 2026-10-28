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
type Salud = {
  ultimaConsulta: string;
  terminos: number;
  fallidos: number;
  error: string | null;
  ultimoExito: string | null;
  viaProxy: boolean;
  proxy: string | null;
};
type BoletinData = {
  cron: CronInfo;
  salud: Salud | null;
  estado: "ok" | "parcial" | "atrasado" | "caido" | "sin-datos";
  proxyConfigurado: boolean;
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

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * El aviso de que el Boletín no se está leyendo. Va arriba de todo porque es
 * la única señal: con el Boletín caído los conteos y la lista se ven normales,
 * sólo que viejos.
 */
function SaludAviso({ data }: { data: BoletinData }) {
  const s = data.salud;
  if (!s) return null;

  if (data.estado === "caido") {
    return (
      <Box padding={3} background="danger100" borderColor="danger600" borderWidth="1px" borderStyle="solid" hasRadius>
        <Typography variant="pi" fontWeight="bold" textColor="danger700">
          El Boletín Oficial no responde: no se están archivando normas
        </Typography>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="danger700">
            En la última consulta ({fmtDateTime(s.ultimaConsulta)}) fallaron las {s.terminos} búsquedas:{" "}
            {s.error ?? "sin detalle"}. No es un día sin normas: no se pudo preguntar.{" "}
            {s.ultimoExito
              ? `La última consulta que respondió fue el ${fmtDateTime(s.ultimoExito)}.`
              : "No hay una consulta exitosa registrada."}
          </Typography>
        </Box>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="danger700">
            {s.viaProxy
              ? "No respondió ninguno de los proxies de BOLETIN_PROXY_URL: ¿están apagadas las PCs de la casa, o se cayeron sus túneles?"
              : "Si dice timeout de conexión, el Boletín está rechazando la IP del servidor (sólo acepta IPs argentinas) y hace falta configurar BOLETIN_PROXY_URL."}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (data.estado === "parcial" || (data.estado === "atrasado" && data.cron.enabled)) {
    return (
      <Box padding={3} background="warning100" borderColor="warning600" borderWidth="1px" borderStyle="solid" hasRadius>
        <Typography variant="pi" textColor="warning700">
          {data.estado === "parcial"
            ? `En la última consulta (${fmtDateTime(s.ultimaConsulta)}) fallaron ${s.fallidos} de ${s.terminos} búsquedas: ${s.error ?? "sin detalle"}. Lo de esos términos no se archivó.`
            : `La última consulta al Boletín fue el ${fmtDateTime(s.ultimaConsulta)}: el cron diario no está corriendo.`}
        </Typography>
      </Box>
    );
  }

  return null;
}

/** El mensaje que trae un 4xx/5xx del backend, en cualquiera de las dos formas que usa. */
function errorMessage(err: unknown): string {
  const data = (err as { response?: { data?: { error?: string | { message?: string } } } })?.response?.data;
  const e = data?.error;
  return (typeof e === "string" ? e : e?.message) || String(err);
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
      const d = res.data as {
        nuevas?: number;
        analizadas?: number;
        encoladas?: number;
        consulta?: { terminos: number; fallidos: number };
      };
      // Que fallen todas vuelve como 502 (cae en el catch); que fallen algunas,
      // como 200 con el conteo: el resultado vale, pero está incompleto.
      const fallidas = d.consulta?.fallidos ?? 0;
      toggleNotification({
        type: fallidas > 0 ? "warning" : "success",
        message:
          action === "sync"
            ? `${d.nuevas ?? 0} normas nuevas, ${d.analizadas ?? 0} analizadas.` +
              (fallidas > 0 ? ` Fallaron ${fallidas} de ${d.consulta!.terminos} búsquedas.` : "")
            : `${d.encoladas ?? 0} normas encoladas para re-analizar.`,
      });
      await load();
    } catch (err) {
      toggleNotification({ type: "danger", message: `No se pudo completar: ${errorMessage(err)}` });
      // El sync caído igual dejó registrada la consulta: recargar muestra el aviso.
      await load();
    } finally {
      setRunning(null);
    }
  };

  if (error) return <Widget.Error />;
  if (!data) return <Widget.Loading />;

  return (
    <Flex className="nib-widget-body" direction="column" alignItems="stretch" gap={3}>
      <Typography variant="pi" textColor="neutral600">
        Cada día el sistema busca en el Boletín Oficial normas nuevas que mencionen los temas de la
        asociación, guarda su texto íntegro y lo hace leer por IA: un puntaje de relevancia que
        descarta el ruido y una ficha con qué cambia y a quién afecta. Las relevantes se publican en
        /normativa y se le pasan al Redactor.
      </Typography>

      <SaludAviso data={data} />

      <Flex gap={2} wrap="wrap" alignItems="center">
        <Badge>{data.cron.enabled ? (data.cron.label ?? "programado") : "cron desactivado"}</Badge>
        <Typography variant="pi" textColor="neutral500">
          barre los últimos {data.sinceDays} días · {data.total} normas archivadas
        </Typography>
      </Flex>
      {data.salud ? (
        <Typography variant="pi" textColor="neutral500">
          Última consulta: {fmtDateTime(data.salud.ultimaConsulta)}
          {data.estado === "ok" ? " · respondieron todas las búsquedas" : ""}
          {data.salud.proxy ? ` · salió por ${data.salud.proxy}` : data.salud.viaProxy ? " · vía proxy" : ""}
        </Typography>
      ) : null}

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
