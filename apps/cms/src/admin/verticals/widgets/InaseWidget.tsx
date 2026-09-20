import * as React from "react";
import { Box, Flex, Typography, Badge, Divider } from "@strapi/design-system";
import { Widget, useFetchClient } from "@strapi/strapi/admin";
import { useUncapHeight } from "./useUncapHeight";

type CronInfo = { enabled: boolean; rule: string | null; label: string | null; tz: string | null };
type Registro = { count: number; lastUpdate: string | null; cron: CronInfo };
type InaseData = { cultivares: Registro; operadores: Registro };

function fmtDate(iso: string | null): string {
  if (!iso) return "sin datos";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function RegistroBlock({
  titulo,
  descripcion,
  reg,
}: {
  titulo: string;
  descripcion: string;
  reg: Registro;
}) {
  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="baseline" gap={2}>
        <Typography variant="omega" fontWeight="bold" textColor="neutral800" style={{ minWidth: 0 }}>
          {titulo}
        </Typography>
        <Typography variant="beta" textColor="neutral800" style={{ flexShrink: 0 }}>
          {reg.count.toLocaleString("es-AR")}
        </Typography>
      </Flex>
      <Box marginTop={1}>
        <Typography variant="pi" textColor="neutral500">
          {descripcion}
        </Typography>
      </Box>
      <Flex gap={2} wrap="wrap" alignItems="center" marginTop={2}>
        <Badge>{reg.cron.enabled ? (reg.cron.label ?? "programado") : "cron desactivado"}</Badge>
        <Typography variant="pi" textColor="neutral400">
          datos hasta {fmtDate(reg.lastUpdate)}
        </Typography>
      </Flex>
    </Box>
  );
}

export default function InaseWidget() {
  useUncapHeight();
  const { get } = useFetchClient();
  const [data, setData] = React.useState<InaseData | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    get("/api/dashboard/inase")
      .then((res: { data: InaseData }) => setData(res.data))
      .catch(() => setError(true));
  }, [get]);

  if (error) return <Widget.Error />;
  if (!data) return <Widget.Loading />;

  return (
    <Flex className="nib-widget-body" direction="column" alignItems="stretch" gap={3}>
      <Typography variant="pi" textColor="neutral600">
        Espejamos dos registros públicos del INASE para que obtentores, productores y cultivadores
        puedan verificar qué compran. Se sincronizan solos por cron; “datos hasta” es la última vez
        que el espejo cambió, no necesariamente la última corrida.
      </Typography>

      <RegistroBlock
        titulo="Cultivares"
        descripcion="Catálogo de variedades inscriptas (quién registró cada genética)."
        reg={data.cultivares}
      />

      <Divider />

      <RegistroBlock
        titulo="Operadores RNCyFS"
        descripcion="Padrón de quienes fraccionan y rotulan semilla (los del N° de rótulo)."
        reg={data.operadores}
      />
    </Flex>
  );
}
