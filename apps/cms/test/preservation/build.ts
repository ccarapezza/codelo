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
import { buildReviewEvidence, reviewWithRecheck } from "../../src/lib/director-review";
import { buildCarouselSystemPrompt, composeCarousel } from "../../src/lib/social-cards/composer";
import { composeSingleSlide } from "../../src/lib/social-studio/compose-single";
import {
  buildClipPrompt,
  buildCoverFallbackPrompt,
  buildOverlayAsk,
  buildOverlaySystemPrompt,
} from "../../src/lib/social-studio/pipeline";
import type { PromptSettings } from "../../src/lib/prompt-defaults";

import * as I from "./inputs";
import { vi } from "vitest";
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

  // El generador manual mete la fecha de HOY en su prompt. Sin congelarla, el
  // fixture caduca a medianoche y el test falla al día siguiente sin que nadie
  // haya tocado una línea.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(I.HOY));
  try {

  const revision = {
    directorInstructions: I.DIRECTOR_INSTRUCTIONS,
    draft: I.DRAFT,
    newsContext: I.NEWS_CONTEXT,
    writerSources: I.WRITER_SOURCES,
    today: I.TODAY,
  };

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
    dedup: await capture((c) =>
      findDuplicateSubject(c, "m", I.TITLE, I.RECENT_TITLES, s),
    ),

    translate: await capture((c) => translatePost(c, "m", I.DRAFT, s)),

    director: await capture((c) => reviewPost(c, "m", s, revision)),

    // La segunda lectura, por el camino real: el grabador contesta el rechazo
    // enlatado, la guarda encuentra la primera afirmación en la fuente [1] y
    // el motor vuelve a llamar. Lo grabado es ESA llamada. Si la guarda dejara
    // de encontrarla no habría segunda llamada, y el fixture compararía el
    // pedido original: el test fallaría, que es lo que tiene que pasar.
    "director.recheck": await capture(
      (c) => reviewWithRecheck(c, "m", s, revision, buildReviewEvidence(I.REVIEW_EVIDENCE)),
      JSON.stringify(I.DIRECTOR_REJECTION),
    ),

    anchors: await capture((c) =>
      extractArticleAnchors(c, "m", I.TITLE, I.EXCERPT, s.imageAnchorTaxonomy),
    ),

    // Los dos caminos de portada: el pool de mood cambia con el tratamiento
    // sorteado, así que foto e ilustración arman prompts distintos.
    "image.photo": await portada(I.SEED_PHOTO),
    "image.art": await portada(I.SEED_ART),

    // El `system` se arma con el builder y un host fijo: el de verdad sale de
    // SITE_PUBLIC_URL y haría que el fixture dependa del env con el que se corre
    // el test. El `user` sí sale de la llamada real.
    carousel: {
      system: buildCarouselSystemPrompt(s, I.SITE_HOST),
      user: (
        await capture((c) =>
          composeCarousel(c, "m", {
            title: I.TITLE,
            excerpt: I.EXCERPT,
            content: I.CONTENT,
            promptSettings: s,
          }),
        )
      ).user,
    },

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

    // Piezas de Social Studio que no pasan por un cliente: se arman directo.
    "video.clip": soloSystem(buildClipPrompt(s)),
    "cover.fallback": soloSystem(buildCoverFallbackPrompt(s, I.TITLE)),
    // El pedido sale del builder real, no de una copia: antes vivía duplicado
    // en inputs.ts y el pipeline podía cambiarlo sin que ninguna fixture se moviera.
    "overlay": soloSystem(buildOverlaySystemPrompt(s, buildOverlayAsk("title", { textos: true, clip: false }))),
    "overlay.clip": soloSystem(buildOverlaySystemPrompt(s, buildOverlayAsk("title", { textos: true, clip: true }))),
  };
  } finally {
    vi.useRealTimers();
  }
}
