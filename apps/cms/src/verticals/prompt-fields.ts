// Campos de prompt propios del vertical.
//
// El motor define los campos comunes en lib/prompt-defaults.ts; los que sólo
// tienen sentido para este proyecto se declaran acá y el motor los mezcla sin
// conocerlos. Un campo nuevo necesita además su atributo en el schema.json del
// single type `prompt-setting`, que es de donde salen los valores que guarda el
// admin.

export const verticalPromptDefaults: Record<string, string> = {};

export const verticalPromptKeys = Object.keys(verticalPromptDefaults);
