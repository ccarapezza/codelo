// Mirrors apps/codelo-cms/src/lib/inase/parse.test.ts. Both must agree: the CMS
// stores the normalized form and the web queries it, so a divergence here shows
// up as a search that silently finds nothing.

import { describe, expect, it } from "vitest";
import { bestMatches, fold, numeroDeInscripcion, parseSerie } from "./match";

describe("fold", () => {
  it("folds diacritics", () => {
    expect(fold("PEÑA")).toBe("PENA");
  });
  it("is null-safe", () => {
    expect(fold(null)).toBe("");
  });
});

describe("bestMatches", () => {
  const cultivares = [{ nombre: "CRAIG" }, { nombre: "TROPICANA WFC" }, { nombre: "MALVINA" }];
  const byName = (c: { nombre: string }) => c.nombre;

  it("recovers the CRAIG label misread as CRAI1", () => {
    expect(bestMatches("CRAI1", cultivares, byName)[0].item.nombre).toBe("CRAIG");
  });

  it("finds a cultivar by prefix", () => {
    expect(bestMatches("tropicana", cultivares, byName)[0].item.nombre).toBe("TROPICANA WFC");
  });

  it("returns nothing for an unrelated query", () => {
    expect(bestMatches("ZAPALLO", cultivares, byName)).toHaveLength(0);
  });
});

describe("parseSerie", () => {
  it("parses the serial decoded from a real stamp", () => {
    expect(parseSerie("01CAA000254089")).toMatchObject({ serie: "000254089", valid: true });
  });
  it("rejects free text so the UI falls back to manual entry", () => {
    expect(parseSerie("no soy una serie").valid).toBe(false);
  });
});

describe("numeroDeInscripcion", () => {
  it("drops the category suffix", () => {
    expect(numeroDeInscripcion("13481EFK1")).toBe(13481);
  });
  it("returns null when there is no number", () => {
    expect(numeroDeInscripcion("ABC")).toBeNull();
  });
});
