import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import {
  buildReviewEvidence,
  claimStems,
  enforceRemovalCap,
  findClaimsInEvidence,
  MAX_REMOVED_CLAIMS,
  reviewWithRecheck,
  type EvidenceItem,
} from "./director-review";
import { reviewPost, type ReviewResult } from "./openai";
import { NEUTRAL_PROMPT_SETTINGS } from "./prompt-defaults";
import { REVIEW_SUMMARY_MAX } from "./source-context";

const fuente = (label: string, text: string): EvidenceItem => ({ label, text });

// El caso real, en neutro: el dato está textual en el resumen, pero no al
// principio, sino después de otro hecho.
const RESUMEN =
  "La cooperativa inauguró su nueva planta. Con tres proyectos en marcha, el grupo prevé " +
  "duplicar el acopio antes de fin de año, según informó su presidenta.";

describe("claimStems", () => {
  it("normaliza acentos y mayúsculas y descarta palabras funcionales", () => {
    expect(claimStems("La Cooperativa amplió SU planta")).toEqual(["cooper", "amplio", "planta"]);
  });

  it("conserva los números enteros: son el dato", () => {
    expect(claimStems("ganó 3 a 1")).toEqual(["gano", "3", "1"]);
  });

  it("los miles con punto o sin él son el mismo número; la coma decimal, un decimal", () => {
    expect(claimStems("6.000 hectáreas")).toEqual(claimStems("6000 hectáreas"));
    expect(claimStems("2,5 millones")).toEqual(["2.5", "millon"]);
  });
});

describe("findClaimsInEvidence", () => {
  it("encuentra una frase textual a mitad de un resumen, y dice dónde", () => {
    const [m] = findClaimsInEvidence(
      ["tres proyectos en marcha"],
      [fuente("source [1] Agencia", `La planta nueva\n${RESUMEN}`)],
    );
    expect(m.label).toBe("source [1] Agencia");
    expect(m.claim).toBe("tres proyectos en marcha");
    expect(m.excerpt).toContain("Con tres proyectos en marcha");
  });

  it("un número distinto no es la misma afirmación", () => {
    expect(findClaimsInEvidence(["cuatro proyectos en marcha"], [fuente("[1]", RESUMEN)])).toEqual([]);
    expect(
      findClaimsInEvidence(["el equipo ganó 3 a 1"], [fuente("[1]", "El equipo ganó 2 a 1 el domingo.")]),
    ).toEqual([]);
  });

  it("las palabras desparramadas por un texto largo no cuentan como la frase", () => {
    const relleno = Array.from({ length: 40 }, (_, i) => `dato${i} distinto`).join(" ");
    const apuntes = `Hay proyectos nuevos. ${relleno}. La obra sigue en marcha.`;
    expect(findClaimsInEvidence(["proyectos en marcha"], [fuente("RESEARCH NOTES", apuntes)])).toEqual([]);
  });

  it("una afirmación de una sola palabra significativa no se busca: la contendría cualquier texto", () => {
    expect(findClaimsInEvidence(["en la planta"], [fuente("[1]", RESUMEN)])).toEqual([]);
  });

  it("en una afirmación larga tolera una palabra de más (80 %)", () => {
    // "recién" no está en la fuente; las otras siete sí.
    const claim = "el grupo prevé duplicar recién el acopio antes de fin de año";
    expect(findClaimsInEvidence([claim], [fuente("[1]", RESUMEN)])).toHaveLength(1);
  });

  it("devuelve la primera coincidencia en el orden de lectura, una por afirmación", () => {
    const encontradas = findClaimsInEvidence(
      ["tres proyectos en marcha"],
      [fuente("RESEARCH NOTES", "Nada que ver."), fuente("[1] A", RESUMEN), fuente("[2] B", RESUMEN)],
    );
    expect(encontradas.map((m) => m.label)).toEqual(["[1] A"]);
  });

  it("busca como mucho cinco afirmaciones", () => {
    const claims = Array.from({ length: 8 }, () => "tres proyectos en marcha");
    expect(findClaimsInEvidence(claims, [fuente("[1]", RESUMEN)])).toHaveLength(5);
  });

  it("el recorte no corta palabras y marca lo omitido", () => {
    const largo = `${"Antes hubo otra cosa. ".repeat(10)}${RESUMEN}${" Y después otra.".repeat(10)}`;
    const [m] = findClaimsInEvidence(["tres proyectos en marcha"], [fuente("[1]", largo)]);
    expect(m.excerpt.startsWith("…")).toBe(true);
    expect(m.excerpt.endsWith("…")).toBe(true);
    // Lo de adentro es un tramo literal del texto que empieza y termina en
    // palabra entera: antes y después hay un espacio.
    const tramo = m.excerpt.slice(1, -1);
    const pos = largo.indexOf(tramo);
    expect(pos).toBeGreaterThan(0);
    expect(largo[pos - 1]).toBe(" ");
    expect(largo[pos + tramo.length]).toBe(" ");
  });
});

describe("buildReviewEvidence", () => {
  const src = (n: number, summary = `resumen ${n}`) => ({
    title: `Título ${n}`,
    source: `Medio ${n}`,
    url: `https://example.com/${n}`,
    summary,
  });

  it("numera como el prompt: fuentes del Redactor primero, contexto después; apuntes al frente", () => {
    const ev = buildReviewEvidence({
      researchNotes: "  apuntes  ",
      writerSources: [src(1), src(2)],
      extraNews: [{ source: "Otro", title: "Extra", summary: "algo" }],
    });
    expect(ev.map((e) => e.label)).toEqual([
      "the RESEARCH NOTES",
      "source [1] Medio 1",
      "source [2] Medio 2",
      "source [3] Otro",
    ]);
    expect(ev[0].text).toBe("apuntes");
    expect(ev[1].text).toBe("Título 1\nresumen 1");
  });

  it("corta el resumen donde lo corta el prompt del revisor", () => {
    const [e] = buildReviewEvidence({ writerSources: [src(1, "x".repeat(REVIEW_SUMMARY_MAX + 50))] });
    expect(e.text.length).toBe("Título 1\n".length + REVIEW_SUMMARY_MAX);
  });

  it("sin apuntes no agrega un bloque vacío", () => {
    expect(buildReviewEvidence({ researchNotes: "  ", writerSources: [] })).toEqual([]);
  });
});

/**
 * Un cliente que contesta en orden y guarda cada conversación que recibe. Un
 * `Error` en el guion se lanza en vez de contestarse.
 */
function clienteGuionado(respuestas: object[]) {
  const llamadas: Array<Array<{ role: string; content: string }>> = [];
  const client = {
    chat: {
      completions: {
        create: async (req: { messages: Array<{ role: string; content: string }> }) => {
          llamadas.push(req.messages);
          const r = respuestas[Math.min(llamadas.length - 1, respuestas.length - 1)];
          if (r instanceof Error) throw r;
          return { choices: [{ message: { content: JSON.stringify(r) } }] };
        },
      },
    },
  } as unknown as OpenAI;
  return { client, llamadas };
}

const INPUT = {
  directorInstructions: "revisá con criterio",
  draft: { title: "La cooperativa amplió su planta", excerpt: "e", content: "c" },
  newsContext: "(vacío)",
  writerSources: `[1] Agencia | La planta nueva\n${RESUMEN}`,
  today: "2026-09-29",
};
const EVIDENCIA = [fuente("source [1] Agencia", `La planta nueva\n${RESUMEN}`)];
const APROBADA = { rejected: false, title: "T", excerpt: "E", content: "C", removedClaims: [] };

describe("reviewWithRecheck", () => {
  it("si aprueba de entrada, una sola llamada", async () => {
    const g = clienteGuionado([APROBADA]);
    const r = await reviewWithRecheck(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT, EVIDENCIA);
    expect(g.llamadas).toHaveLength(1);
    expect(r.recheck).toBeNull();
    expect(r.result.rejected).toBe(false);
  });

  it("un rechazo por algo que de verdad no está se sostiene sin segunda lectura", async () => {
    const rechazo = { rejected: true, reason: "no está", unsupportedClaims: ["cinco sucursales nuevas"] };
    const g = clienteGuionado([rechazo]);
    const r = await reviewWithRecheck(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT, EVIDENCIA);
    expect(g.llamadas).toHaveLength(1);
    expect(r.recheck).toBeNull();
    expect(r.result).toEqual(rechazo);
  });

  it("si lo que da por ausente está en la evidencia, relee en la misma conversación", async () => {
    const rechazo = {
      rejected: true,
      reason: "«tres proyectos en marcha» no figura en ninguna fuente",
      unsupportedClaims: ["tres proyectos en marcha", "cinco sucursales nuevas"],
    };
    const g = clienteGuionado([rechazo, APROBADA]);
    const r = await reviewWithRecheck(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT, EVIDENCIA);

    expect(g.llamadas).toHaveLength(2);
    const [system, user, previo, pedido] = g.llamadas[1];
    expect(g.llamadas[1].map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    // Misma conversación: el system y el borrador son los de la primera lectura.
    expect(system).toEqual(g.llamadas[0][0]);
    expect(user).toEqual(g.llamadas[0][1]);
    expect(JSON.parse(previo.content)).toEqual(rechazo);
    expect(pedido.content).toContain('Your claim: "tres proyectos en marcha"');
    expect(pedido.content).toContain("In source [1] Agencia: «");
    // Lo que no encontró no se le muestra como si estuviera.
    expect(pedido.content).not.toContain("cinco sucursales");

    expect(r.result.rejected).toBe(false);
    expect(r.recheck?.firstReason).toBe(rechazo.reason);
    expect(r.recheck?.found.map((m) => m.claim)).toEqual(["tres proyectos en marcha"]);
  });

  it("si la relectura falla, vale el primer rechazo y queda el error", async () => {
    const rechazo = { rejected: true, reason: "no", unsupportedClaims: ["tres proyectos en marcha"] };
    const g = clienteGuionado([rechazo, new Error("respuesta cortada")]);
    const r = await reviewWithRecheck(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT, EVIDENCIA);
    expect(g.llamadas).toHaveLength(2);
    expect(r.result).toEqual(rechazo);
    expect(r.recheck?.error).toBe("respuesta cortada");
  });

  it("vale lo que diga en la segunda lectura, y no hay tercera", async () => {
    const rechazo = { rejected: true, reason: "no", unsupportedClaims: ["tres proyectos en marcha"] };
    const g = clienteGuionado([rechazo, rechazo, APROBADA]);
    const r = await reviewWithRecheck(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT, EVIDENCIA);
    expect(g.llamadas).toHaveLength(2);
    expect(r.result.rejected).toBe(true);
    expect(r.recheck).not.toBeNull();
  });
});

describe("enforceRemovalCap", () => {
  const aprobada = (n: number): ReviewResult => ({
    ...APROBADA,
    rejected: false,
    removedClaims: Array.from({ length: n }, (_, i) => `frase ${i + 1}`),
  });

  it(`hasta ${MAX_REMOVED_CLAIMS} frases quitadas, publica`, () => {
    const r = aprobada(MAX_REMOVED_CLAIMS);
    expect(enforceRemovalCap(r)).toBe(r);
  });

  it("con más, la trata como rechazo y deja las frases a la vista", () => {
    const r = enforceRemovalCap(aprobada(MAX_REMOVED_CLAIMS + 1));
    expect(r.rejected).toBe(true);
    if (r.rejected === true) {
      expect(r.reason).toContain(`quitó ${MAX_REMOVED_CLAIMS + 1} frases`);
      expect(r.reason).toContain("«frase 4»");
      expect(r.unsupportedClaims).toHaveLength(MAX_REMOVED_CLAIMS + 1);
    }
  });

  it("un rechazo pasa tal cual", () => {
    const r: ReviewResult = { rejected: true, reason: "x", unsupportedClaims: [] };
    expect(enforceRemovalCap(r)).toBe(r);
  });
});

describe("reviewPost: las listas del veredicto", () => {
  it("sin removedClaims, la lista queda vacía", async () => {
    const g = clienteGuionado([{ rejected: false, title: "T", excerpt: "E", content: "C" }]);
    const r = await reviewPost(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT);
    expect(r).toMatchObject({ rejected: false, removedClaims: [] });
  });

  it("tolera objetos { claim } y descarta lo que no es texto", async () => {
    const g = clienteGuionado([
      {
        rejected: true,
        reason: "r",
        unsupportedClaims: [{ claim: " una frase " }, 42, "", "otra frase", null],
      },
    ]);
    const r = await reviewPost(g.client, "m", NEUTRAL_PROMPT_SETTINGS, INPUT);
    expect(r).toEqual({ rejected: true, reason: "r", unsupportedClaims: ["una frase", "otra frase"] });
  });
});
