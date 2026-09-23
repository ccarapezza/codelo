// Una sección de la tarjeta «El sitio público», plegable.
//
// Las tres integraciones que agrupa —analítica, anuncios, mapas de calor— son
// opcionales y, en una instalación típica, ninguna está configurada. Desplegadas
// ocupaban más de la mitad de la pantalla de ajustes con campos vacíos: AdSense
// sola tiene siete, y la grilla estiraba a Clarity —que tiene UNO— a la misma
// altura.
//
// Plegarlas no es esconderlas: el encabezado dice si están configuradas y con
// cuántos valores, así que se ve de un vistazo lo que antes había que leer
// campo por campo. Y una sección con algo cargado arranca ABIERTA: lo que ya
// está en uso no se oculta nunca.

import * as React from "react";
import { Box, Flex, Typography } from "@strapi/design-system";
import { ChevronDown, ChevronRight } from "@strapi/icons";
import { useT } from "../../i18n";

export function SeccionPlegable({
  titulo,
  descripcion,
  configurados,
  icono,
  children,
}: {
  titulo: string;
  descripcion: string;
  /** Cuántos de sus campos tienen valor. Decide el estado inicial y la insignia. */
  configurados: number;
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useT();
  // Abierta si ya hay algo cargado. El estado inicial se calcula una vez: si se
  // recalculara en cada render, vaciar el último campo cerraría la sección de
  // golpe mientras se está escribiendo en ella.
  const [abierta, setAbierta] = React.useState(configurados > 0);

  return (
    <Box>
      <Box
        tag="button"
        type="button"
        onClick={() => setAbierta((v) => !v)}
        paddingTop={3}
        paddingBottom={3}
        style={{
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Flex justifyContent="space-between" alignItems="center" gap={3}>
          <Flex gap={2} alignItems="center" style={{ minWidth: 0 }}>
            <Box style={{ display: "flex", flexShrink: 0 }} textColor="neutral500">
              {abierta ? <ChevronDown width="1.2rem" /> : <ChevronRight width="1.2rem" />}
            </Box>
            {icono ? (
              <Box style={{ display: "flex", flexShrink: 0 }} textColor="neutral500">
                {icono}
              </Box>
            ) : null}
            <Box style={{ minWidth: 0 }}>
              <Typography variant="omega" fontWeight="bold" textColor="neutral800">
                {titulo}
              </Typography>
              <Box>
                <Typography variant="pi" textColor="neutral600">
                  {descripcion}
                </Typography>
              </Box>
            </Box>
          </Flex>
          <Typography
            variant="pi"
            textColor={configurados > 0 ? "success600" : "neutral500"}
            style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            {configurados > 0 ? t("ajustes.seccion.configurada", { n: configurados }) : t("ajustes.seccion.vacia")}
          </Typography>
        </Flex>
      </Box>
      {abierta ? (
        <Box paddingLeft={7} paddingBottom={4}>
          <Flex direction="column" alignItems="stretch" gap={4}>
            {children}
          </Flex>
        </Box>
      ) : null}
    </Box>
  );
}
