// Cases here are taken from real INASE data and real seed packets, not invented.
// Verified against gestion.inase.gob.ar on 21/07/2026 and against three physical
// physical seed labels photographed during development (not kept in the repo).

import { describe, expect, it } from "vitest";
import { bestMatches, normalizeName, parseNumeroInscripcion, parseSerieEstampilla } from "./parse";

describe("parseNumeroInscripcion", () => {
  it("splits number from category suffix", () => {
    expect(parseNumeroInscripcion("1FG")).toMatchObject({
      numero: 1,
      categorias: ["F", "G"],
      valid: true,
    });
  });

  it("keeps compound codes together", () => {
    // The bug this guards: `K2` tokenized as `K` + `2` invents a category and
    // loses a real one. Real row from the padrón.
    expect(parseNumeroInscripcion("5667HK2O").categorias).toEqual(["H", "K2", "O"]);
  });

  it("parses the operator from the Tropicana WFC label", () => {
    expect(parseNumeroInscripcion("13481EFK1")).toMatchObject({
      numero: 13481,
      categorias: ["E", "F", "K1"],
      valid: true,
    });
  });

  it("handles a long all-single-letter suffix", () => {
    expect(parseNumeroInscripcion("10ABCDEFGHIP").categorias).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "P",
    ]);
  });

  it("accepts a bare number with no categories", () => {
    expect(parseNumeroInscripcion("11238A")).toMatchObject({ numero: 11238, valid: true });
  });

  it("degrades instead of throwing on an unknown code", () => {
    // A new category should downgrade one row, never abort the whole sync.
    const r = parseNumeroInscripcion("123ZZ");
    expect(r.valid).toBe(false);
    expect(r.numero).toBe(123);
  });

  it("rejects a non-numeric leading part", () => {
    expect(parseNumeroInscripcion("ABC").valid).toBe(false);
  });
});

describe("normalizeName", () => {
  it("folds diacritics so users find accented rows", () => {
    expect(normalizeName("PEÑA")).toBe("PENA");
    expect(normalizeName("CAÑAS")).toBe("CANAS");
  });

  it("folds INASE's own encoding damage to something searchable", () => {
    // The padrón ships `GÜEMES` as `GÑEMES` and has 44 rows with a literal `?`.
    // Neither is recoverable, so both must at least normalize consistently.
    expect(normalizeName("VILLA CA?AS")).toBe("VILLA CA AS");
    expect(normalizeName("GÑEMES")).toBe("GNEMES");
  });

  it("strips punctuation from company names", () => {
    expect(normalizeName('"COOP. AGROP. Y FOREST. LTDA."')).toBe("COOP AGROP Y FOREST LTDA");
  });

  it("is null-safe", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
  });
});

describe("bestMatches", () => {
  const cultivares = [
    { nombre: "CRAIG" },
    { nombre: "TROPICANA WFC" },
    { nombre: "PASTEL DE CHOQUE" },
    { nombre: "MALVINA" },
    { nombre: "BALLENA FRANCA" },
  ];
  const byName = (c: { nombre: string }) => c.nombre;

  it("recovers a misread label", () => {
    // `CRAIG` reads as `CRAI1` off curved foil — this is the exact misreading
    // that happened while planning this feature.
    expect(bestMatches("CRAI1", cultivares, byName)[0].item.nombre).toBe("CRAIG");
  });

  it("finds a cultivar by prefix", () => {
    expect(bestMatches("TROPICANA", cultivares, byName)[0].item.nombre).toBe("TROPICANA WFC");
  });

  it("matches regardless of case and accents", () => {
    expect(bestMatches("pastel de choque", cultivares, byName)[0].item.nombre).toBe(
      "PASTEL DE CHOQUE",
    );
  });

  it("returns nothing for an unrelated query", () => {
    expect(bestMatches("ZANAHORIA GIGANTE", cultivares, byName)).toHaveLength(0);
  });

  it("returns nothing for an empty query", () => {
    expect(bestMatches("", cultivares, byName)).toHaveLength(0);
  });
});

describe("parseSerieEstampilla", () => {
  it("parses the serial decoded from the Tropicana WFC DataMatrix", () => {
    expect(parseSerieEstampilla("01CAA000254089")).toMatchObject({
      prefijo: "01CAA",
      serie: "000254089",
      valid: true,
    });
  });

  it("parses the serials printed on the other two packets", () => {
    expect(parseSerieEstampilla("01CAA000046673").serie).toBe("000046673");
    expect(parseSerieEstampilla("01CAA000159986").serie).toBe("000159986");
  });

  it("tolerates whitespace and lowercase from a scanner", () => {
    expect(parseSerieEstampilla(" 01caa000254089 ").serie).toBe("000254089");
  });

  it("does not assume the 01CAA prefix is universal", () => {
    // Three samples cannot establish that. Another prefix must parse, not fail.
    expect(parseSerieEstampilla("02XY000123456")).toMatchObject({
      prefijo: "02XY",
      valid: true,
    });
  });

  it("rejects free text so the reader falls back to manual search", () => {
    expect(parseSerieEstampilla("https://example.com/algo").valid).toBe(false);
    expect(parseSerieEstampilla("").valid).toBe(false);
  });
});
