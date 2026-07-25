import * as React from "react";
import { Box, Flex, Typography, Badge, Divider } from "@strapi/design-system";
import { Widget, useFetchClient } from "@strapi/strapi/admin";
import { useUncapHeight } from "./useUncapHeight";

type CronInfo = { enabled: boolean; rule: string | null; label: string | null; tz: string | null };
type Item = {
  title: string;
  url: string;
  source: string;
  itemPublishedAt: string | null;
};
type BoletinData = {
  cron: CronInfo;
  terms: string[];
  sinceDays: number;
  total: number;
  items: Item[];
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

/** El rubro viaja pegado al source: "Boletín Oficial · RESOLUCIONES". */
function rubroOf(source: string): string | null {
  const parts = source.split("·");
  return parts.length > 1 ? parts[1].trim() : null;
}

export default function BoletinWidget() {
  useUncapHeight();
  const { get } = useFetchClient();
  const [data, setData] = React.useState<BoletinData | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    get("/api/dashboard/boletin")
      .then((res: { data: BoletinData }) => setData(res.data))
      .catch(() => setError(true));
  }, [get]);

  if (error) return <Widget.Error />;
  if (!data) return <Widget.Loading />;

  return (
    <Flex className="codelo-widget-body" direction="column" alignItems="stretch" gap={3}>
      <Typography variant="pi" textColor="neutral600">
        Cada día el sistema busca en el Boletín Oficial normas nuevas que mencionen los temas de la
        asociación y las guarda como contexto para que el Redactor pueda escribir sobre cambios
        regulatorios con la norma como fuente. Es complementario a los feeds RSS.
      </Typography>

      <Flex gap={2} wrap="wrap" alignItems="center">
        <Badge>{data.cron.enabled ? (data.cron.label ?? "programado") : "cron desactivado"}</Badge>
        <Typography variant="pi" textColor="neutral500">
          barre los últimos {data.sinceDays} días · {data.total} normas guardadas
        </Typography>
      </Flex>

      <Box>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Términos que busca
        </Typography>
        <Flex gap={1} wrap="wrap" marginTop={1}>
          {data.terms.map((t) => (
            <Badge key={t} backgroundColor="neutral150" textColor="neutral700">
              {t}
            </Badge>
          ))}
        </Flex>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral500">
            Exige que todas las palabras del término aparezcan en la norma (no alcanza con una).
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Últimas normas capturadas
        </Typography>
        {data.items.length === 0 ? (
          <Box marginTop={1}>
            <Typography variant="pi" textColor="neutral500">
              Todavía no se guardó ninguna norma. Es normal: hay términos (p. ej. REPROCANN) que casi
              nunca aparecen literales en el Boletín.
            </Typography>
          </Box>
        ) : (
          <Flex direction="column" alignItems="stretch" gap={2} marginTop={2}>
            {data.items.slice(0, 5).map((it, i) => {
              const rubro = rubroOf(it.source);
              return (
                <Box key={i}>
                  {/* Sin ellipsis: el título envuelve a varias líneas en vez de
                      empujar el ancho y disparar scroll horizontal. */}
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "inherit", textDecoration: "none", overflowWrap: "anywhere" }}
                  >
                    <Typography variant="pi" textColor="primary600">
                      {it.title}
                    </Typography>
                  </a>
                  <Flex gap={2} alignItems="center" wrap="wrap">
                    {rubro ? (
                      <Typography variant="pi" textColor="neutral500">
                        {rubro.toLowerCase()}
                      </Typography>
                    ) : null}
                    {it.itemPublishedAt ? (
                      <Typography variant="pi" textColor="neutral400">
                        · {fmtDate(it.itemPublishedAt)}
                      </Typography>
                    ) : null}
                  </Flex>
                </Box>
              );
            })}
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
