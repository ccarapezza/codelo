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
 * Los idiomas que ofrecen «prompts.writingLanguage.label» y «prompts.translationLanguage.label».
 *
 * El VALOR es el nombre en inglés porque es lo que se interpola en los prompts
 * («You are a journalist writing in Spanish…»); la etiqueta va en castellano
 * para quien configura. Es un select y no texto libre porque un typo acá
 * degrada la salida de todos los agentes sin dar un solo error.
 */
const IDIOMAS = [
  { value: "Spanish", label: "prompts.idioma.es" },
  { value: "English", label: "prompts.idioma.en" },
  { value: "Portuguese", label: "prompts.idioma.pt" },
  { value: "French", label: "prompts.idioma.fr" },
  { value: "Italian", label: "prompts.idioma.it" },
  { value: "German", label: "prompts.idioma.de" },
  { value: "Catalan", label: "prompts.idioma.ca" },
];

export const ENGINE_PROMPT_CARDS: PromptCard[] = [
  {
    id: "identidad",
    title: "prompts.identidad.titulo",
    description:
      "prompts.identidad.desc",
    accent: "primary",
    icon: <Feather />,
    fields: [
      {
        key: "brandName",
        lang: "fijo",
        label: "prompts.brandName.label",
        hint: "prompts.brandName.hint",
      },
      {
        key: "domainDescription",
        label: "prompts.domain.label",
        hint: "prompts.domain.hint",
        rows: 4,
        reference: "You are a journalist writing in {idioma} for {esto}.",
      },
      {
        key: "writingLanguage",
        lang: "fijo",
        label: "prompts.writingLanguage.label",
        hint: "prompts.writingLanguage.hint",
        options: IDIOMAS,
      },
    ],
  },
  {
    id: "linea-editorial",
    title: "prompts.linea.titulo",
    description:
      "prompts.linea.desc",
    accent: "success",
    icon: <Pencil />,
    fields: [
      {
        key: "fabricationProneFacts",
        label: "prompts.fabrication.label",
        hint: "prompts.fabrication.hint",
        rows: 3,
        reference: "NEVER invent {esto}.",
      },
      {
        key: "analysisModeFraming",
        label: "prompts.analysis.label",
        hint: "prompts.analysis.hint",
        rows: 3,
      },
      {
        key: "bodyStructureGuide",
        label: "prompts.body.label",
        hint: "prompts.body.hint",
        rows: 12,
      },
      {
        key: "officialSources",
        label: "prompts.sources.label",
        hint: "prompts.sources.hint",
        rows: 2,
        reference:
          "NOTE: an official source is NOT a rival outlet. Citing an official source ({esto}), a law or a court ruling is REQUIRED, not a violation.",
      },
    ],
  },
  {
    id: "portadas",
    title: "prompts.portadas.titulo",
    description:
      "prompts.portadas.desc",
    accent: "warning",
    icon: <Eye />,
    fields: [
      {
        key: "imageSystemInstructions",
        label: "prompts.imageRules.label",
        hint: "prompts.imageRules.hint",
        rows: 12,
      },
      {
        key: "imageThemeGuide",
        label: "prompts.themeGuide.label",
        hint: "prompts.themeGuide.hint",
        rows: 12,
      },
      {
        key: "imageAnchorTaxonomy",
        label: "prompts.anchors.label",
        hint: "prompts.anchors.hint",
        rows: 8,
      },
      {
        key: "brandPalette",
        lang: "fijo",
        label: "prompts.palette.label",
        hint: "prompts.palette.hint",
      },
    ],
  },
  {
    id: "redes",
    title: "prompts.redes.titulo",
    description:
      "prompts.redes.desc",
    accent: "secondary",
    icon: <Images />,
    fields: [
      {
        key: "socialHandle",
        lang: "fijo",
        label: "prompts.handle.label",
        hint: "prompts.handle.hint",
      },
      {
        key: "socialVoice",
        label: "prompts.socialVoice.label",
        hint: "prompts.socialVoice.hint",
        rows: 8,
      },
      {
        key: "socialCoverStyle",
        label: "prompts.coverStyle.label",
        hint: "prompts.coverStyle.hint",
        rows: 4,
      },
      {
        key: "socialHashtags",
        lang: "salida",
        label: "prompts.hashtags.label",
        hint: "prompts.hashtags.hint",
        rows: 2,
      },
      {
        key: "socialCta",
        lang: "salida",
        label: "prompts.cta.label",
        hint: "prompts.cta.hint",
      },
      {
        key: "coverFallbackPrompt",
        label: "prompts.fallback.label",
        hint: "prompts.fallback.hint",
        rows: 3,
      },
      {
        key: "videoStyle",
        label: "prompts.videoStyle.label",
        hint: "prompts.videoStyle.hint",
        rows: 6,
      },
      {
        key: "videoDefaultPrompt",
        label: "prompts.videoDefault.label",
        hint: "prompts.videoDefault.hint",
        rows: 3,
      },
    ],
  },
  {
    id: "traduccion",
    title: "prompts.traduccion.titulo",
    description:
      "prompts.traduccion.desc",
    accent: "primary",
    icon: <Command />,
    fields: [
      {
        key: "translationLanguage",
        lang: "fijo",
        label: "prompts.translationLanguage.label",
        hint: "prompts.translationLanguage.hint",
        options: IDIOMAS,
      },
      {
        key: "translationGlossary",
        label: "prompts.glossary.label",
        hint: "prompts.glossary.hint",
        rows: 5,
      },
    ],
  },
];
