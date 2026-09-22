// Arma TODOS los prompts del motor con un juego de ajustes dado.
//
// Lo usan los dos lados: `capture.test.ts` para escribir los fixtures y
// `prompts.test.ts` para compararlos. Compartir el armado es lo que garantiza
// que no puedan divergir — si la captura y la verificación tuvieran cada una su
// copia, el test podría pasar comparando algo que ya no es lo que corre.

import {
  extractArticleAnchors,
  findDuplicateSubject,
  generateImagePromptCandidates,
  resolvePromptConstraints,
  reviewPost,
  translatePost,
  type ArticleAnchors,
} from "../../src/lib/openai";
import {
  buildGenerateUserPrompt,
  buildNewsSystemPrompt,
  refinePost,
} from "../../src/lib/news-generator";
import { composeCarousel } from "../../src/lib/social-cards/composer";
import { composeSingleSlide } from "../../src/lib/social-studio/compose-single";
import {
  DEFAULT_VIDEO_PROMPT,
  VIDEO_BG_STYLE,
} from "../../src/lib/social-studio/pipeline";
import type { PromptSettings } from "../../src/lib/prompt-defaults";

import * as I from "./inputs";
import { capture, type Grabado } from "./recorder";

const SIN_ANCLAS: ArticleAnchors = {
  topic: null,
  palette: null,
  eventType: null,
  venue: null,
  season: null,
};

const soloSystem = (texto: string): Grabado => ({ system: texto, user: "" });

export async function construirPrompts(
  ajustes: Record<string, string>,
): Promise<Record<string, Grabado>> {
  const s = ajustes as unknown as PromptSettings;

  const portada = async (seed: string): Promise<Grabado> =>
    capture((c) =>
      generateImagePromptCandidates(c, "m", I.TITLE, I.EXCERPT, {
        systemInstructions: s.imageSystemInstructions,
        themeGuide: s.imageThemeGuide,
        constraints: resolvePromptConstraints(seed, SIN_ANCLAS),
        recentDescriptions: I.RECENT_DESCRIPTIONS,
        candidates: 2,
      }),
    );

  return {
    dedup: await capture((c) => findDuplicateSubject(c, "m", I.TITLE, I.RECENT_TITLES)),

    translate: await capture((c) => translatePost(c, "m", I.DRAFT)),

    director: await capture((c) =>
      reviewPost(
        c,
        "m",
        I.DIRECTOR_INSTRUCTIONS,
        I.DRAFT,
        I.NEWS_CONTEXT,
        s.fabricationProneFacts,
        s.brandName,
        I.WRITER_SOURCES,
      ),
    ),

    anchors: await capture((c) =>
      extractArticleAnchors(c, "m", I.TITLE, I.EXCERPT, s.imageAnchorTaxonomy),
    ),

    // Los dos caminos de portada: el pool de mood cambia con el tratamiento
    // sorteado, así que foto e ilustración arman prompts distintos.
    "image.photo": await portada(I.SEED_PHOTO),
    "image.art": await portada(I.SEED_ART),

    carousel: await capture((c) =>
      composeCarousel(c, "m", {
        title: I.TITLE,
        excerpt: I.EXCERPT,
        content: I.CONTENT,
        promptSettings: s,
      }),
    ),

    story: await capture((c) =>
      composeSingleSlide(c, "m", {
        title: I.TITLE,
        excerpt: I.EXCERPT,
        content: I.CONTENT,
        template: "cover",
        promptSettings: s,
      }),
    ),

    refine: await capture((c) => refinePost(c, "m", s, I.DRAFT, I.REFINE_INSTRUCTION, null)),

    // Ya son puros. Se capturan las DOS ramas: sin investigación web y con
    // ella, porque el bloque de investigación es el único lugar donde aparece
    // la regla de fuentes oficiales.
    news: {
      system: buildNewsSystemPrompt(s),
      user: buildGenerateUserPrompt(s, I.ADMIN_PROMPT, null),
    },
    "news.research": {
      system: buildNewsSystemPrompt(s),
      user: buildGenerateUserPrompt(s, I.ADMIN_PROMPT, I.RESEARCH),
    },

    // Constantes que hoy no dependen de los ajustes y en A2 sí van a depender.
    "video.style": soloSystem(VIDEO_BG_STYLE),
    "video.default": soloSystem(DEFAULT_VIDEO_PROMPT),
  };
}
