// Entradas fijas para armar los prompts de preservación.
//
// Son deliberadamente NEUTRAS: no nombran ningún tema. Así, la única diferencia
// entre el prompt armado de un proyecto y el de otro son sus ajustes, y el test
// de neutralidad puede reusar estas mismas entradas sin tener que inventar otras.
//
// Nada de esto puede cambiar sin volver a capturar los fixtures: cambiar una
// entrada cambia el prompt y el test empieza a fallar por la razón equivocada.

import type { GeneratedPost } from "../../src/lib/openai";

export const TITLE = "El organismo publicó el nuevo régimen de inscripción";
export const EXCERPT =
  "La medida fija plazos y requisitos para quienes ya estaban inscriptos y para los que se sumen este año.";
export const CONTENT = [
  "## Qué cambia",
  "",
  "El texto ordena en un solo trámite lo que antes estaba repartido en tres ventanillas.",
  "",
  "> La transición se hace en etapas y con plazos escalonados.",
  "",
  "- Un registro único para todas las categorías.",
  "- Plazos de 30 días para la primera renovación.",
].join("\n");

export const DRAFT: GeneratedPost = {
  title: TITLE,
  excerpt: EXCERPT,
  content: CONTENT,
};

export const NEWS_CONTEXT = [
  "[1] Agencia Central | El organismo publicó el nuevo régimen de inscripción",
  "La medida unifica el trámite y fija plazos escalonados para la renovación.",
].join("\n");

export const WRITER_SOURCES = [
  "[1] Agencia Central | El organismo publicó el nuevo régimen de inscripción",
  "El texto unifica en un solo trámite lo que estaba repartido en tres ventanillas.",
].join("\n");

export const RECENT_TITLES = [
  "Se aprobó el presupuesto anual del área",
  "El organismo unificó el trámite de inscripción",
  "Dos entidades obtuvieron su registro este mes",
];

export const DIRECTOR_INSTRUCTIONS =
  "Priorizá la claridad sobre el impacto. Si una afirmación no está en la fuente, sacala.";

export const AGENT_INSTRUCTIONS =
  "Escribí con voz propia, en párrafos cortos, explicando el efecto práctico para el lector.";

export const AGENT_TOPIC = "registro inscripción trámite renovación organismo";

export const ADMIN_PROMPT =
  "Contá qué cambia con el nuevo régimen de inscripción y a quién le afecta.";

export const RESEARCH = {
  context: [
    "- El organismo publicó el nuevo régimen el 12 de marzo.",
    "- La renovación pasa a tener un plazo de 30 días.",
  ].join("\n"),
  sources: [{ title: "Agencia Central", url: "https://example.com/regimen" }],
};

export const REFINE_INSTRUCTION = "Hacela más corta y sacá la repetición del segundo párrafo.";

export const SITE_HOST = "example.com";

export const OVERLAY_ASK =
  'Devolvé JSON { "kicker": "<etiqueta corta, <=22 chars, MAYÚSCULAS implícitas>", "title": "<gancho de la nota, <=55 chars>" }';

export const RECENT_DESCRIPTIONS = [
  "A wide desk with stacked folders under warm window light.",
  "An empty meeting room seen from the doorway.",
];

/**
 * Dos semillas elegidas para que el sorteo de tratamiento caiga una en foto y
 * otra en ilustración: los dos caminos arman el prompt distinto (el pool de
 * mood cambia con el tratamiento) y hay que congelar los dos.
 * `seeds.test.ts` verifica que sigan cayendo donde deben.
 */
export const SEED_PHOTO = "preservacion-5";
export const SEED_ART = "preservacion-0";
