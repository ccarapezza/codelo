import { describe, expect, it } from "vitest";
import { buildReviewSystemPrompt } from "./openai";
import { NEUTRAL_PROMPT_SETTINGS } from "./prompt-defaults";

const base = {
  directorInstructions: "revisá con criterio",
  draft: { title: "t", excerpt: "e", content: "c" },
  newsContext: "(vacío)",
  writerSources: "[1] medio.com.ar | Una nota\nresumen",
  today: "2026-09-24",
};

describe("el bloque de apuntes en el prompt de revisión", () => {
  it("no aparece cuando la nota no vino de una investigación", () => {
    const p = buildReviewSystemPrompt(NEUTRAL_PROMPT_SETTINGS, base);
    expect(p).not.toContain("RESEARCH NOTES");
  });

  // El motivo de que exista: con los apuntes metidos dentro del resumen de la
  // primera fuente, el revisor rechazaba por "sin respaldo" cifras que estaban
  // en ese mismo bloque.
  it("aparece con los apuntes y los declara evidencia primaria", () => {
    const p = buildReviewSystemPrompt(NEUTRAL_PROMPT_SETTINGS, {
      ...base,
      researchNotes: "- En 2024 la superficie fue de 9.850 hectáreas (INV).",
    });
    expect(p).toContain("RESEARCH NOTES");
    expect(p).toContain("9.850 hectáreas");
    expect(p).toMatch(/PRIMARY evidence/i);
  });

  it("va ANTES del bloque de fuentes, que es el orden en que se lee", () => {
    const p = buildReviewSystemPrompt(NEUTRAL_PROMPT_SETTINGS, {
      ...base,
      researchNotes: "- un hecho",
    });
    expect(p.indexOf("RESEARCH NOTES")).toBeLessThan(p.indexOf("SOURCES THE WRITER ACTUALLY USED"));
  });

  it("unos apuntes en blanco no agregan un bloque vacío", () => {
    const p = buildReviewSystemPrompt(NEUTRAL_PROMPT_SETTINGS, { ...base, researchNotes: "   " });
    expect(p).not.toContain("RESEARCH NOTES");
  });
});
