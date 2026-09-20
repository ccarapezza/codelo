import * as React from "react";
import { Box, Flex, Loader, Typography } from "@strapi/design-system";
import { Check, Cross } from "@strapi/icons";
import { AccentCard } from "../../components/ui";
import type { JobState } from "./types";

// Progreso del job: lista de pasos con estado + detalle (ej. "procesando… 2m 10s").
export default function JobProgress({ job }: { job: JobState }) {
  return (
    <AccentCard
      title="Generando…"
      description={`Costo estimado: ~$${job.estimatedCostUsd.toFixed(3)} USD`}
      accent={job.status === "failed" ? "danger" : "primary"}
    >
      <Flex direction="column" alignItems="stretch" gap={3}>
        {job.steps.map((s) => (
          <Flex key={s.key} gap={3} alignItems="center">
            <Box style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>
              {s.status === "done" ? (
                <Typography textColor="success600"><Check width="1rem" height="1rem" /></Typography>
              ) : s.status === "error" ? (
                <Typography textColor="danger600"><Cross width="1rem" height="1rem" /></Typography>
              ) : s.status === "running" ? (
                <Loader small />
              ) : (
                <Box background="neutral300" style={{ width: 8, height: 8, borderRadius: "50%" }} />
              )}
            </Box>
            <Box style={{ minWidth: 0 }}>
              <Typography
                variant="omega"
                textColor={s.status === "pending" ? "neutral500" : "neutral800"}
                fontWeight={s.status === "running" ? "bold" : undefined}
              >
                {s.label}
              </Typography>
              {s.detail ? (
                <Box>
                  <Typography variant="pi" textColor="neutral500" ellipsis>
                    {s.detail}
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Flex>
        ))}
        {job.status === "failed" && job.error ? (
          <Box background="danger100" hasRadius padding={3} marginTop={2}>
            <Typography variant="pi" textColor="danger700">
              {job.error}
            </Typography>
          </Box>
        ) : null}
      </Flex>
    </AccentCard>
  );
}
