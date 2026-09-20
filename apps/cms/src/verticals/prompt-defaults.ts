// Los prompts de ESTE vertical: qué cubre el sitio, con qué voz escribe y qué
// tiene que mostrar una portada.
//
// Es una COSTURA. El motor (lib/prompt-defaults.ts) define la estructura y unos
// valores neutros; acá se reemplazan por los del proyecto, y el admin puede
// volver a pisarlos desde la pantalla de Prompts IA sin tocar código.
//
// Es EL archivo que hay que escribir para apuntar el motor a un tema. Mientras
// esté vacío, los agentes trabajan con los defaults neutros del motor: sirven
// para probar que el circuito anda, no para publicar.
//
// Los cuatro bloques largos que conviene definir:
//   · bodyStructureGuide      — voz, estructura del cuerpo, reglas duras del
//                               dominio (qué no se puede afirmar nunca).
//   · imageSystemInstructions — qué puede y qué no puede mostrar una portada.
//   · imageThemeGuide         — catálogo TEMA → ESCENAS. Si trae variantes
//                               "(a) … (d)", el motor sortea una por artículo.
//   · imageAnchorTaxonomy     — qué anclas visuales extraer de cada nota.
//     ⚠️ La taxonomía y la interfaz ArticleAnchors (lib/openai.ts) tienen que
//     estar sincronizadas: si la taxonomía pide un campo que el parser no lee,
//     se descarta en silencio y nadie se entera.

export const promptDefaults = {};
