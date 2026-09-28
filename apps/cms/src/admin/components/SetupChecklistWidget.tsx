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
import { useT } from "../i18n";

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
  const t = useT();
  if (!iso) return "nunca";
  const d = new Date(iso);
  const horas = (Date.now() - d.getTime()) / 36e5;
  if (horas < 1) return t("setup.haceMenos");
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Fila({ check }: { check: SetupCheck }) {
  const t = useT();
  // El servidor manda el texto ya escrito; acá se traduce POR ID. Los ids de
  // los checks son estables (`openai-key`, `brand-name`…), así que no hay que
  // cambiar el contrato de la API — y si un id no está en el catálogo, cae al
  // texto del servidor, que es lo que se mostraba antes.
  const etiqueta = t(`setup.check.${check.id}`, {}) || check.label;
  const detalle = check.detail ? t(`setup.check.${check.id}.detalle`, {}) : "";
  const contenido = (
    <Flex gap={2} alignItems="flex-start" paddingTop={2} paddingBottom={2}>
      <Box paddingTop={1}>{ICONO[check.status]}</Box>
      <Box style={{ minWidth: 0 }}>
        <Typography
          variant="omega"
          fontWeight={check.status === "ok" ? "regular" : "bold"}
          textColor={check.status === "ok" ? "neutral600" : "neutral800"}
        >
          {etiqueta === `setup.check.${check.id}` ? check.label : etiqueta}
        </Typography>
        {check.detail ? (
          <Box paddingTop={1}>
            <Typography variant="pi" textColor="neutral600">
              {detalle && detalle !== `setup.check.${check.id}.detalle` ? detalle : check.detail}
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
  const t = useT();
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
          <Badge backgroundColor="success100" textColor="success700">{t("setup.listo")}</Badge>
        ) : (
          <Badge backgroundColor="danger100" textColor="danger700">
            {t("setup.sinResolver", { n: bloqueantes.length })}
          </Badge>
        )}
        <Typography variant="pi" textColor="neutral600">
          {t("setup.resumen", {
            fuentes: cuando(data.lastRssRun),
            agentes: cuando(data.lastAgentRun),
            publicadas: data.publishedPosts,
          })}
        </Typography>
      </Flex>

      {faltan.length === 0 ? (
        <Typography variant="pi" textColor="neutral600">{t("setup.completo")}</Typography>
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
