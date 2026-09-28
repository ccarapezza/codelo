// Roles de agente que suma este vertical, además de los cuatro del motor
// (director, redactor, explorador, image-generator).
//
// Es una COSTURA: `lib/agent-runner.ts` despacha por nombre y busca acá lo que
// no reconoce, así que agregar un rol propio no toca el motor. Un proyecto sin
// roles extra exporta un objeto vacío, y entonces un rol desconocido falla con
// el mismo error de siempre.
//
// ⚠️ Un rol nuevo no alcanza con declararlo acá. Hay que sumarlo además:
//   1. al enum `role` de src/api/agent/content-types/agent/schema.json y al
//      `agentRole` de agent-action. Postgres NO lo respalda —Strapi 5.54 no
//      crea CHECK para los enums—, pero `strapi.documents()` sí lo valida: sin
//      el valor en el enum, el alta del agente se rechaza. La auditoría escribe
//      por `strapi.db.query`, que no valida, así que ahí el síntoma es otro:
//      las filas entran y el panel las muestra sin etiqueta;
//   2. a `agentRoles` en src/admin/verticals.ts, para que el panel lo ofrezca
//      en el selector y sepa cómo etiquetarlo en la auditoría.

import type { Core } from "@strapi/strapi";

/** Firma de un runner: la misma con que el motor invoca a los suyos. */
export type RunnerFn = (
  strapi: Core.Strapi,
  agent: { documentId: string; name: string; instructions: string; topic: string | null },
  notesCount: number,
) => Promise<void>;

export const verticalAgentRoles: Record<string, RunnerFn> = {};
