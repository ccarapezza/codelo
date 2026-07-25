import * as React from "react";
import { Box, Flex, Typography, Badge, Divider } from "@strapi/design-system";
import { useUncapHeight } from "./useUncapHeight";

// Widget PURAMENTE INFORMATIVO. El termohigrómetro vive en la web (codelo-web),
// no en el CMS: calcula el clima para cultivo con datos de Open-Meteo en vivo,
// según la ubicación de cada visitante. No hay cron ni datos guardados acá, así
// que esta tarjeta sólo explica de dónde sale y con qué criterio avisa.
//
// ⚠️ Los umbrales son un ESPEJO de apps/codelo-web/lib/weather.ts (función
// evaluarAviso). Si allá cambian, hay que actualizarlos acá a mano.

type Nivel = "alerta" | "atencion" | "ok";
const COLOR: Record<Nivel, { bg: string; fg: string; punto: string }> = {
  alerta: { bg: "danger100", fg: "danger700", punto: "🔴" },
  atencion: { bg: "warning100", fg: "warning700", punto: "🟡" },
  ok: { bg: "success100", fg: "success700", punto: "🟢" },
};

const ALERTAS: Array<{ nivel: Nivel; nombre: string; criterio: string }> = [
  { nivel: "alerta", nombre: "Helada", criterio: "temperatura ≤ 0 °C" },
  { nivel: "alerta", nombre: "Calor extremo", criterio: "temperatura ≥ 38 °C" },
  { nivel: "alerta", nombre: "Ventana Botrytis", criterio: "humedad ≥ 90 % con 10–27 °C" },
  { nivel: "alerta", nombre: "Condensación", criterio: "hoja mojada / punto de rocío alcanzado" },
  { nivel: "alerta", nombre: "Demanda muy alta", criterio: "VPD ≥ 3.0 kPa (la planta transpira de más)" },
  { nivel: "atencion", nombre: "Riesgo de helada", criterio: "temperatura ≤ 3 °C" },
  { nivel: "atencion", nombre: "Hongos favorable", criterio: "humedad ≥ 75 % con 17–24 °C" },
  { nivel: "atencion", nombre: "Oídio", criterio: "humedad alta con follaje seco y cielo despejado" },
  { nivel: "atencion", nombre: "Demanda alta", criterio: "VPD ≥ 2.0 kPa" },
  { nivel: "atencion", nombre: "Aire quieto", criterio: "VPD ≤ 0.25 kPa (poca transpiración)" },
  { nivel: "ok", nombre: "Favorable", criterio: "VPD en rango ideal (~0.8–1.2 kPa)" },
];

export default function TermohigrometroWidget() {
  useUncapHeight();
  return (
    <Flex className="codelo-widget-body" direction="column" alignItems="stretch" gap={3}>
      <Typography variant="pi" textColor="neutral600">
        El termohigrómetro de la web muestra el clima para cultivo —temperatura, humedad y VPD
        (déficit de presión de vapor, cuánta “sed” tiene el aire)— y dispara alertas agronómicas.
      </Typography>

      <Box>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          De dónde salen los datos
        </Typography>
        <Flex gap={2} wrap="wrap" alignItems="center" marginTop={1}>
          <Badge>Open-Meteo</Badge>
          <Badge backgroundColor="neutral150" textColor="neutral700">
            en vivo · sin cron
          </Badge>
        </Flex>
        <Box marginTop={1}>
          <Typography variant="pi" textColor="neutral500">
            Servicio meteorológico gratuito. Se consulta al abrir la página, según la ubicación que
            elige cada visitante (por defecto, Buenos Aires). No se guarda nada en el CMS.
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box>
        <Typography variant="pi" fontWeight="bold" textColor="neutral600">
          Alertas y con qué criterio
        </Typography>
        <Flex direction="column" alignItems="stretch" gap={1} marginTop={2}>
          {ALERTAS.map((a) => (
            <Flex key={a.nombre} gap={2} alignItems="baseline">
              <Typography variant="pi">{COLOR[a.nivel].punto}</Typography>
              {/* minWidth:0 + overflowWrap para que el criterio largo envuelva
                  dentro del ancho del card y no dispare scroll horizontal. */}
              <Box style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                <Typography variant="pi" fontWeight="bold" textColor="neutral700">
                  {a.nombre}
                </Typography>
                <Typography variant="pi" textColor="neutral500">
                  {" "}— {a.criterio}
                </Typography>
              </Box>
            </Flex>
          ))}
        </Flex>
        <Box marginTop={2}>
          <Typography variant="pi" textColor="neutral400">
            🔴 alerta · 🟡 atención · 🟢 favorable. Los umbrales exactos viven en el código de la web
            (lib/weather.ts); esta tarjeta los resume.
          </Typography>
        </Box>
      </Box>
    </Flex>
  );
}
