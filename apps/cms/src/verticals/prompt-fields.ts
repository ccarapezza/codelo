// Campos de prompt propios del vertical.
//
// El motor define los campos comunes en lib/prompt-defaults.ts; los que sólo
// tienen sentido para este proyecto se declaran acá y el motor los mezcla sin
// conocerlos. Los valores guardados por el admin siguen viniendo del single
// type `prompt-setting`, así que un campo nuevo necesita además su atributo en
// el schema.json de ese content-type.

import { BOLETIN_ANALYSIS_INSTRUCTIONS } from "./boletin-prompts";

export const verticalPromptDefaults: Record<string, string> = {
  boletinAnalysisInstructions: BOLETIN_ANALYSIS_INSTRUCTIONS,
};

export const verticalPromptKeys = Object.keys(verticalPromptDefaults);
