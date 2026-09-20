// Tests del MECANISMO de relevancia editorial, no de las palabras de un
// vertical: las listas se inyectan mockeando verticals/rss-scope, así que el
// test sigue valiendo cuando codelo las complete o cuando otro proyecto adopte
// el motor con las suyas.

import { describe, it, expect, vi, beforeEach } from "vitest";

// El módulo del vertical se mockea ANTES de importar el que lo consume.
const listas = {
  scope: [] as string[],
  ambiguous: [] as string[],
  contextCues: [] as string[],
  denylist: [] as string[],
};
vi.mock("../verticals/rss-scope", () => listas);

const { isEditoriallyRelevant } = await import("./rss-fetcher");

function setListas(next: Partial<typeof listas>) {
  listas.scope = next.scope ?? [];
  listas.ambiguous = next.ambiguous ?? [];
  listas.contextCues = next.contextCues ?? [];
  listas.denylist = next.denylist ?? [];
}

beforeEach(() => setListas({}));

describe("isEditoriallyRelevant", () => {
  it("sin alcance declarado deja pasar todo (el caso de codelo hoy)", () => {
    expect(isEditoriallyRelevant({ title: "Cualquier cosa", summary: "" })).toBe(true);
    expect(isEditoriallyRelevant({ title: "El dólar hoy", summary: null })).toBe(true);
  });

  it("acepta por un término inequívoco del alcance", () => {
    setListas({ scope: ["reprocann"] });
    expect(isEditoriallyRelevant({ title: "Cómo renovar el REPROCANN", summary: "" })).toBe(true);
  });

  it("descarta lo que no matchea ningún término", () => {
    setListas({ scope: ["reprocann"] });
    expect(isEditoriallyRelevant({ title: "Messi ganó otro premio", summary: "" })).toBe(false);
  });

  it("no matchea un término dentro de otra palabra", () => {
    setListas({ scope: ["cáñamo"] });
    expect(isEditoriallyRelevant({ title: "Cañamoquis, banda de rock", summary: "" })).toBe(false);
  });

  it("matchea respetando acentos", () => {
    setListas({ scope: ["cáñamo"] });
    expect(isEditoriallyRelevant({ title: "Industria del cáñamo", summary: "" })).toBe(true);
  });

  it("un término ambiguo NO alcanza solo", () => {
    setListas({ ambiguous: ["planta"], contextCues: ["cannabis"] });
    expect(isEditoriallyRelevant({ title: "Cerró la planta automotriz", summary: "" })).toBe(false);
  });

  it("un término ambiguo cuenta si hay pista de contexto", () => {
    setListas({ ambiguous: ["planta"], contextCues: ["cannabis"] });
    expect(
      isEditoriallyRelevant({ title: "Cuidados de la planta", summary: "cultivo de cannabis" }),
    ).toBe(true);
  });

  it("la denylist gana aunque el término del alcance esté presente", () => {
    setListas({ scope: ["cannabis"], denylist: ["publinota"] });
    expect(
      isEditoriallyRelevant({ title: "Cannabis y salud", summary: "publinota de la marca" }),
    ).toBe(false);
  });

  it("busca también en el summary, no sólo en el título", () => {
    setListas({ scope: ["ley 27.350"] });
    expect(
      isEditoriallyRelevant({ title: "Nueva resolución", summary: "en el marco de la Ley 27.350" }),
    ).toBe(true);
  });
});
