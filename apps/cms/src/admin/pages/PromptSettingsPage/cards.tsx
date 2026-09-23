// Las tarjetas de Configuración editorial, como DATOS.
//
// Estaban escritas en el JSX de la pantalla, así que un proyecto que necesitaba
// una tarjeta propia tenía que editar un archivo del motor — que es justamente
// cómo terminó habiendo una tarjeta de un vertical dentro del panel de todos.
// Ahora la pantalla recorre esta lista y la del proyecto (admin/verticals.ts).
//
// El ORDEN es el de una puesta en marcha: quién sos → cómo escribís → cómo se
// ven las portadas → cómo se publica en redes → cómo se traduce. Cada tarjeta es
// un PASO de la pantalla, así que el orden es el del asistente; la numeración la
// pone la pantalla, para que una tarjeta de un proyecto no tenga que saber qué
// número le toca. El checklist de la home enlaza a cada paso por su `id`.

import * as React from "react";
import { Command, Eye, Feather, Images, Pencil } from "@strapi/icons";
import type { PromptCard } from "../../seam-types";

/**
 * Los idiomas que ofrecen «Idioma de escritura» y «Idioma de destino».
 *
 * El VALOR es el nombre en inglés porque es lo que se interpola en los prompts
 * («You are a journalist writing in Spanish…»); la etiqueta va en castellano
 * para quien configura. Es un select y no texto libre porque un typo acá
 * degrada la salida de todos los agentes sin dar un solo error.
 */
const IDIOMAS = [
  { value: "Spanish", label: "Español" },
  { value: "English", label: "Inglés" },
  { value: "Portuguese", label: "Portugués" },
  { value: "French", label: "Francés" },
  { value: "Italian", label: "Italiano" },
  { value: "German", label: "Alemán" },
  { value: "Catalan", label: "Catalán" },
];

export const ENGINE_PROMPT_CARDS: PromptCard[] = [
  {
    id: "identidad",
    title: "Identidad",
    description:
      "Quién escribe y de qué habla el sitio. Es lo primero que leen todos los agentes: el redactor, el Director, el deduplicador y el traductor.",
    accent: "primary",
    icon: <Feather />,
    fields: [
      {
        key: "brandName",
        lang: "fijo",
        label: "Nombre de la marca",
        hint: "Con este nombre escriben los agentes y se firman las placas.",
      },
      {
        key: "domainDescription",
        label: "De qué habla el sitio",
        hint: "Completa la frase «You are a journalist writing … for {esto}». Lo usan el redactor, el Director, el deduplicador y el traductor: si dice de más o de menos, todos se desvían igual.",
        rows: 4,
        reference: "You are a journalist writing in {idioma} for {esto}.",
      },
      {
        key: "writingLanguage",
        lang: "fijo",
        label: "Idioma de escritura",
        hint: "En qué idioma escriben los agentes las notas, los captions y las placas.",
        options: IDIOMAS,
      },
    ],
  },
  {
    id: "linea-editorial",
    title: "Línea editorial",
    description:
      "Las reglas que separan una nota publicable de una que hay que rechazar. Las comparten el Redactor y el Director.",
    accent: "success",
    icon: <Pencil />,
    fields: [
      {
        key: "fabricationProneFacts",
        label: "Hechos que no se pueden inventar",
        hint: "Lista separada por comas de los datos que este tema suele alucinar: fechas, cifras, resoluciones, resultados.",
        rows: 3,
        reference: "NEVER invent {esto}.",
      },
      {
        key: "analysisModeFraming",
        label: "Encuadre del modo análisis",
        hint: "Cómo tiene que presentarse una nota cuando NO hay noticias verificadas que la respalden.",
        rows: 3,
      },
      {
        key: "bodyStructureGuide",
        label: "Voz y formato del cuerpo",
        hint: "La voz de la marca y las reglas de Markdown. Es el campo más largo y el que más define cómo suenan las notas.",
        rows: 12,
      },
      {
        key: "officialSources",
        label: "Fuentes oficiales citables",
        hint: "Organismos y publicaciones que SÍ se pueden nombrar sin que cuente como reproducir a un medio rival. Los nombres propios van como se escriben.",
        rows: 2,
        reference:
          "NOTE: an official source is NOT a rival outlet. Citing an official source ({esto}), a law or a court ruling is REQUIRED, not a violation.",
      },
    ],
  },
  {
    id: "portadas",
    title: "Portadas",
    description:
      "Qué se ve en la imagen de una nota. El medio (foto, ilustración, grabado) lo sortea el motor por nota; acá se decide QUÉ mostrar y con qué reglas.",
    accent: "warning",
    icon: <Eye />,
    fields: [
      {
        key: "imageSystemInstructions",
        label: "Reglas de imagen",
        hint: "Qué se muestra, qué está prohibido, cómo se evitan las caras. El sufijo de seguridad se agrega siempre, aunque se borre todo esto.",
        rows: 12,
      },
      {
        key: "imageThemeGuide",
        label: "Catálogo de escenas",
        hint: "TEMA → ESCENAS. Cada categoría ofrece cuatro variantes para que dos notas parecidas no salgan con la misma portada.",
        rows: 12,
      },
      {
        key: "imageAnchorTaxonomy",
        label: "Anclas a extraer",
        hint: "⚠️ Cada línea «- clave: regla» declara una clave que se le pide al modelo. Agregar o quitar una línea cambia lo que se extrae: el motor lee las claves de acá, no las tiene escritas.",
        rows: 8,
      },
      {
        key: "brandPalette",
        lang: "fijo",
        label: "Paleta de la casa",
        hint: "Dos colores, para el acabado duotono del sorteo de ilustraciones. Ej: «amber and deep-blue».",
      },
    ],
  },
  {
    id: "redes",
    title: "Redes y video",
    description:
      "Con qué usuario se firman, cómo suenan y qué aspecto tienen las piezas de Social Studio: carruseles, historias y clips. Los colores y el logo con los que se DIBUJAN las placas se eligen en Sitio e integraciones → Identidad visual: no son texto y no los lee ningún agente.",
    accent: "secondary",
    icon: <Images />,
    fields: [
      {
        key: "socialHandle",
        lang: "fijo",
        label: "Usuario de redes",
        hint: "Sin el @. Se imprime al pie de cada placa, grande en la placa de cierre y sobre los videos, y cierra el caption como último hashtag. Vacío = no se imprime en ningún lado.",
      },
      {
        key: "socialVoice",
        label: "Voz en redes y reglas duras",
        hint: "Qué tipo de organización es, cómo suena y qué NO se hace nunca. Es una instrucción, así que va en inglés; el texto que se publica sale en el idioma del sitio.",
        rows: 8,
      },
      {
        key: "socialCoverStyle",
        label: "Estilo de la imagen de portada",
        hint: "Qué tiene que mostrar el fondo de la primera placa. Se inserta dentro del pedido de imagen.",
        rows: 4,
      },
      {
        key: "socialHashtags",
        lang: "salida",
        label: "Temas de los hashtags",
        hint: "Separados por coma. Vacío = el modelo elige según la nota.",
        rows: 2,
      },
      {
        key: "socialCta",
        lang: "salida",
        label: "Cierre del caption",
        hint: "Se pega tal cual al final del caption. Vacío = no se agrega nada.",
      },
      {
        key: "coverFallbackPrompt",
        label: "Imagen de respaldo",
        hint: "Se usa cuando el modelo no devuelve un pedido de imagen propio. Sin esto la portada quedaba en negro.",
        rows: 3,
      },
      {
        key: "videoStyle",
        label: "Estilo de video",
        hint: "Se agrega a TODO clip. Acá van la atmósfera, la paleta y las prohibiciones (sin texto, sin logos).",
        rows: 6,
      },
      {
        key: "videoDefaultPrompt",
        label: "Clip por defecto",
        hint: "El b-roll que propone Social Studio cuando no se escribe uno.",
        rows: 3,
      },
    ],
  },
  {
    id: "traduccion",
    title: "Traducción",
    description:
      "Sólo se usa si la traducción automática está activada, en Sitio e integraciones.",
    accent: "primary",
    icon: <Command />,
    fields: [
      {
        key: "translationLanguage",
        lang: "fijo",
        label: "Idioma de destino",
        hint: "A qué idioma se traduce cada nota. El de origen es el de escritura.",
        options: IDIOMAS,
      },
      {
        key: "translationGlossary",
        label: "Qué NO se traduce",
        hint: "Línea completa del prompt. Acá van los nombres propios del tema: organismos, programas, competencias, términos sin equivalente.",
        rows: 5,
      },
    ],
  },
];
