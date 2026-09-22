// Las tarjetas de Configuración editorial, como DATOS.
//
// Estaban escritas en el JSX de la pantalla, así que un proyecto que necesitaba
// una tarjeta propia tenía que editar un archivo del motor — que es justamente
// cómo terminó habiendo una tarjeta de un vertical dentro del panel de todos.
// Ahora la pantalla recorre esta lista y la del proyecto (admin/verticals.ts).
//
// El ORDEN es el de una puesta en marcha: quién sos → cómo escribís → cómo se
// ven las portadas → cómo se publica en redes → cómo se traduce. El checklist
// de la home enlaza a cada tarjeta por su `id`.

import * as React from "react";
import { Command, Eye, Feather, Images, Pencil } from "@strapi/icons";
import type { PromptCard } from "../../seam-types";

export const ENGINE_PROMPT_CARDS: PromptCard[] = [
  {
    id: "identidad",
    title: "1 · Identidad",
    description:
      "Quién escribe y de qué habla el sitio. Es lo primero que leen todos los agentes, y de acá sale también con qué nombre se firman las placas de redes.",
    accent: "primary",
    icon: <Feather />,
    fields: [
      {
        key: "brandName",
        label: "Nombre de la marca",
        hint: "Con este nombre escriben los agentes y se firman las placas.",
      },
      {
        key: "domainDescription",
        label: "De qué habla el sitio (en inglés)",
        hint: "Completa la frase «You are a journalist writing … for {esto}». Lo usan el redactor, el Director, el deduplicador y el traductor: si dice de más o de menos, todos se desvían igual.",
        rows: 4,
        reference: "You are a journalist writing in {idioma} for {esto}.",
      },
      {
        key: "writingLanguage",
        label: "Idioma de escritura",
        hint: "En inglés y con mayúscula: Spanish, English, Português.",
      },
      {
        key: "socialHandle",
        label: "Usuario de redes",
        hint: "Sin @. Se imprime en las placas y cierra el caption. Vacío = no se imprime.",
      },
    ],
  },
  {
    id: "linea-editorial",
    title: "2 · Línea editorial",
    description:
      "Las reglas que separan una nota publicable de una que hay que rechazar. Las comparten el Redactor y el Director.",
    accent: "success",
    icon: <Pencil />,
    fields: [
      {
        key: "fabricationProneFacts",
        label: "Hechos que no se pueden inventar (en inglés)",
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
        hint: "Organismos y publicaciones que SÍ se pueden nombrar sin que cuente como reproducir a un medio rival. En el idioma de escritura.",
        rows: 2,
        reference:
          "NOTE: an official source is NOT a rival outlet. Citing an official source ({esto}), a law or a court ruling is REQUIRED, not a violation.",
      },
    ],
  },
  {
    id: "portadas",
    title: "3 · Portadas",
    description:
      "Qué se ve en la imagen de una nota. El medio (foto, ilustración, grabado) lo sortea el motor por nota; acá se decide QUÉ mostrar y con qué reglas.",
    accent: "warning",
    icon: <Eye />,
    fields: [
      {
        key: "imageSystemInstructions",
        label: "Reglas de imagen (en inglés)",
        hint: "Qué se muestra, qué está prohibido, cómo se evitan las caras. El sufijo de seguridad se agrega siempre, aunque se borre todo esto.",
        rows: 12,
      },
      {
        key: "imageThemeGuide",
        label: "Catálogo de escenas (en inglés)",
        hint: "TEMA → ESCENAS. Cada categoría ofrece cuatro variantes para que dos notas parecidas no salgan con la misma portada.",
        rows: 12,
      },
      {
        key: "imageAnchorTaxonomy",
        label: "Anclas a extraer (en inglés)",
        hint: "⚠️ Cada línea «- clave: regla» declara una clave que se le pide al modelo. Agregar o quitar una línea cambia lo que se extrae: el motor lee las claves de acá, no las tiene escritas.",
        rows: 8,
      },
      {
        key: "brandPalette",
        label: "Paleta de la casa (en inglés)",
        hint: "Dos colores, para el acabado duotono del sorteo de ilustraciones. Ej: «amber and deep-blue».",
      },
    ],
  },
  {
    id: "redes",
    title: "4 · Redes y video",
    description:
      "La voz y el aspecto de las piezas de Social Studio: carruseles, historias y clips.",
    accent: "secondary",
    icon: <Images />,
    fields: [
      {
        key: "socialVoice",
        label: "Voz en redes y reglas duras",
        hint: "Qué tipo de organización es, cómo suena y qué NO se hace nunca. Va en el idioma de escritura.",
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
        label: "Temas de los hashtags",
        hint: "Separados por coma. Vacío = el modelo elige según la nota.",
        rows: 2,
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
    title: "5 · Traducción",
    description:
      "Sólo se usa si la traducción automática está activada, en Sitio e integraciones.",
    accent: "primary",
    icon: <Command />,
    fields: [
      {
        key: "translationLanguage",
        label: "Idioma de destino (en inglés)",
        hint: "Ej: English. El idioma de origen es el de escritura.",
      },
      {
        key: "translationGlossary",
        label: "Qué NO se traduce (en inglés)",
        hint: "Línea completa del prompt. Acá van los nombres propios del tema: organismos, programas, competencias, términos sin equivalente.",
        rows: 5,
      },
    ],
  },
];
