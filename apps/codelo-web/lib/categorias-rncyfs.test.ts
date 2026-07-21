// Pins the legend against the official INASE reference sheet and against the
// codes that actually occur in the padrón.
//
// This table tells a reader what a seed seller is authorised to do, so the risk
// is not a crash — it is a wrong-but-plausible entry that nobody notices. These
// tests exist to make an edit-from-memory fail loudly.

import { describe, expect, it } from "vitest";
import { CATEGORIAS_RNCYFS, categoriaInfo } from "./categorias-rncyfs";

/**
 * Every code observed across all 3.032 operators of the padrón (21/07/2026).
 * `J` and `K` never occur bare — operators always carry the size subcategory —
 * but both are defined in the reference sheet, so both stay covered.
 */
const CODIGOS_EN_PADRON = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J1",
  "J2",
  "K1",
  "K2",
  "N",
  "O",
  "P",
];

describe("CATEGORIAS_RNCYFS", () => {
  it("covers every code that appears in the padrón", () => {
    for (const codigo of CODIGOS_EN_PADRON) {
      expect(categoriaInfo(codigo), `falta la categoría ${codigo}`).not.toBeNull();
    }
  });

  it("defines the parent categories J and K too", () => {
    expect(categoriaInfo("J")?.nombre).toMatch(/certificador/i);
    expect(categoriaInfo("K")?.nombre).toMatch(/identificador/i);
  });

  it("has no codes beyond the reference sheet", () => {
    // L and M do not exist in the RNCyFS. An extra key here would mean someone
    // invented a category.
    expect(Object.keys(CATEGORIAS_RNCYFS).sort()).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "J1",
      "J2",
      "K",
      "K1",
      "K2",
      "N",
      "O",
      "P",
    ]);
  });

  it("keeps the categories from the Tropicana WFC label readable", () => {
    // 13481EFK1 — the operator printed on a real packet.
    expect(categoriaInfo("E")?.nombre).toBe("Identificador");
    expect(categoriaInfo("F")?.nombre).toBe("Comerciante expendedor");
    expect(categoriaInfo("K1")?.nombre).toMatch(/vivero identificador/i);
  });

  it("ties E to the label's own wording", () => {
    // The packet says "El identificador se hace responsable...". Category E is
    // what makes that sentence checkable, so the link must survive edits.
    expect(categoriaInfo("E")?.descripcion).toMatch(/rótulo/i);
    expect(categoriaInfo("E")?.descripcion).toMatch(/20\.247/);
  });

  it("gives every category a name and a definition", () => {
    for (const [codigo, info] of Object.entries(CATEGORIAS_RNCYFS)) {
      expect(info.nombre.length, `${codigo} sin nombre`).toBeGreaterThan(3);
      expect(info.descripcion.length, `${codigo} sin descripción`).toBeGreaterThan(40);
    }
  });

  it("returns null for an unknown code instead of guessing", () => {
    // A new category must render as a bare code, never as a neighbouring
    // meaning: claiming an authorisation someone lacks is the failure that
    // matters here.
    expect(categoriaInfo("L")).toBeNull();
    expect(categoriaInfo("Z9")).toBeNull();
    expect(categoriaInfo("")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(categoriaInfo("k1")?.nombre).toBe(categoriaInfo("K1")?.nombre);
  });
});
