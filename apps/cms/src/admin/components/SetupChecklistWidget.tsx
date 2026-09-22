// Puesta en marcha: qué le falta a esta instancia para publicar.
//
// Es el widget que ve cualquiera al entrar al panel. Existe porque una
// instalación puede estar impecable y no publicar nada por una sola cosa que
// falta —un Director inactivo, cero fuentes— y eso antes sólo se descubría
// corriendo un agente y mirando por qué no pasó nada.
//
// Cuando no falta nada, se corre a un costado: deja de ser una lista de tareas y
// pasa a ser un resumen de la última corrida.

import * as React from "react";
import { Badge, Box, Flex, Typography } from "@strapi/design-system";
import { CheckCircle, CrossCircle, WarningCircle } from "@strapi/icons";
import { Widget, useFetchClient } from "@strapi/strapi/admin";
import { NavLink } from "react-router-dom";
import { useUncapHeight } from "../hooks/useUncapHeight";

type SetupStatus = "ok" | "warn" | "missing";

type SetupCheck = {
  id: string;
  label: string;
  status: SetupStatus;
  blocking: boolean;
  detail?: string;
  to?: string;
};

type SetupReport = {
  ready: boolean;
  checks: SetupCheck[];
  lastRssRun: string | null;
  lastAgentRun: string | null;
  publishedPosts: number;
};

const ICONO: Record<SetupStatus, React.ReactNode> = {
  ok: <CheckCircle fill="success600" width="1.2rem" height="1.2rem" />,
  warn: <WarningCircle fill="warning600" width="1.2rem" height="1.2rem" />,
  missing: <CrossCircle fill="danger600" width="1.2rem" height="1.2rem" />,
};

function cuando(iso: string | null): string {
  if (!iso) return "nunca";
  const d = new Date(iso);
  const horas = (Date.now() - d.getTime()) / 36e5;
  if (horas < 1) return "hace menos de una hora";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Fila({ check }: { check: SetupCheck }) {
  const contenido = (
    <Flex gap={2} alignItems="flex-start" paddingTop={2} paddingBottom={2}>
      <Box paddingTop={1}>{ICONO[check.status]}</Box>
      <Box style={{ minWidth: 0 }}>
        <Typography
          variant="omega"
          fontWeight={check.status === "ok" ? "regular" : "bold"}
          textColor={check.status === "ok" ? "neutral600" : "neutral800"}
        >
          {check.label}
        </Typography>
        {check.detail ? (
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral600">
              {check.detail}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Flex>
  );

  // Lo que ya está resuelto no necesita enlace: el link es para ir a arreglarlo.
  if (!check.to || check.status === "ok") return contenido;
  return (
    <NavLink to={check.to} style={{ textDecoration: "none" }}>
      {contenido}
    </NavLink>
  );
}

export default function SetupChecklistWidget() {
  // Strapi le pone tope de alto al cuerpo de un widget y lo vuelve scrolleable:
  // una lista de pendientes cortada en el cuarto ítem no sirve de checklist.
  useUncapHeight();
  const { get } = useFetchClient();
  const [data, setData] = React.useState<SetupReport | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    get<SetupReport>("/api/setup/status")
      .then((r) => setData(r.data))
      .catch(() => setError(true));
  }, [get]);

  if (error) return <Widget.Error />;
  if (!data) return <Widget.Loading />;

  const faltan = data.checks.filter((c) => c.status !== "ok");
  const bloqueantes = faltan.filter((c) => c.blocking);

  return (
    <Flex className="nib-widget-body" direction="column" alignItems="stretch" gap={2}>
      <Flex gap={2} alignItems="center" wrap="wrap">
        {data.ready ? (
          <Badge backgroundColor="success100" textColor="success700">
            listo para publicar
          </Badge>
        ) : (
          <Badge backgroundColor="danger100" textColor="danger700">
            {bloqueantes.length} sin resolver
          </Badge>
        )}
        <Typography variant="pi" textColor="neutral600">
          Fuentes: {cuando(data.lastRssRun)} · Agentes: {cuando(data.lastAgentRun)} ·{" "}
          {data.publishedPosts} publicadas
        </Typography>
      </Flex>

      {faltan.length === 0 ? (
        <Typography variant="pi" textColor="neutral600">
          No falta nada. Los agentes pueden escribir y publicar.
        </Typography>
      ) : (
        <Box>
          {/* Sólo lo pendiente: una lista de 12 tildes verdes no dice nada. */}
          {faltan.map((c) => (
            <Fila key={c.id} check={c} />
          ))}
        </Box>
      )}
    </Flex>
  );
}
