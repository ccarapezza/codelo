// Tests del MECANISMO de la costura de pools, no de los pools de un vertical:
// la costura se mockea, como en rss-scope.test.ts.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CoverPools } from "./cover-pools";

// El módulo del vertical se mockea ANTES de importar el que lo consume.
const costura: { verticalCoverPools: Partial<CoverPools> } = { verticalCoverPools: {} };
vi.mock("../verticals/cover-pools", () => costura);

const { resolvePromptConstraints } = await import("./openai");
const { ENGINE_POOLS } = await import("./cover-pools");

const SIN_ANCLAS = { topic: null, palette: null, eventType: null, venue: null, season: null };
const SEMILLAS = Array.from({ length: 40 }, (_, i) => `nota-${i}`);
const PALETA = "dos colores";

beforeEach(() => {
  costura.verticalCoverPools = {};
});

describe("resolvePromptConstraints con la costura de pools", () => {
  it("sin costura, todo sale de los pools del motor", () => {
    const moods = new Set([
      ...ENGINE_POOLS.moods.map((m) => m.value),
      ...ENGINE_POOLS.artRenders(PALETA).map((m) => m.value),
    ]);
    for (const s of SEMILLAS) {
      const c = resolvePromptConstraints(s, SIN_ANCLAS, PALETA);
      expect(ENGINE_POOLS.compositions).toContain(c.composition);
      expect(ENGINE_POOLS.treatments).toContainEqual(c.treatment);
      expect(moods.has(c.mood)).toBe(true);
    }
  });

  it("un pool propio reemplaza al del motor, y los demás siguen siendo del motor", () => {
    costura.verticalCoverPools = { compositions: ["un único encuadre"] };
    for (const s of SEMILLAS) {
      const c = resolvePromptConstraints(s, SIN_ANCLAS, PALETA);
      expect(c.composition).toBe("un único encuadre");
      expect(ENGINE_POOLS.treatments).toContainEqual(c.treatment);
    }
  });

  it("con tratamientos dibujados propios, el acabado sale de artRenders", () => {
    costura.verticalCoverPools = {
      treatments: [{ kind: "art", value: "grabado propio" }],
      artRenders: (p) => [{ tone: "warm", value: `tinta ${p}` }],
    };
    const c = resolvePromptConstraints("cualquiera", SIN_ANCLAS, PALETA);
    expect(c.treatment).toEqual({ kind: "art", value: "grabado propio" });
    expect(c.mood).toBe(`tinta ${PALETA}`);
  });

  it("un tratamiento fotográfico toma la luz de los moods propios", () => {
    costura.verticalCoverPools = {
      treatments: [{ kind: "photo", value: "foto propia" }],
      moods: [{ tone: "night", value: "luz propia" }],
    };
    expect(resolvePromptConstraints("x", SIN_ANCLAS, PALETA).mood).toBe("luz propia");
  });

  it("un pool vacío se ignora: nunca sale una restricción undefined", () => {
    costura.verticalCoverPools = { compositions: [], treatments: [], moods: [], artRenders: () => [] };
    for (const s of SEMILLAS) {
      const c = resolvePromptConstraints(s, SIN_ANCLAS, PALETA);
      expect(c.composition).toEqual(expect.any(String));
      expect(c.treatment?.value).toEqual(expect.any(String));
      expect(c.mood).toEqual(expect.any(String));
    }
  });

  it("la misma semilla da siempre lo mismo", () => {
    expect(resolvePromptConstraints("fija", SIN_ANCLAS, PALETA)).toEqual(
      resolvePromptConstraints("fija", SIN_ANCLAS, PALETA),
    );
  });
});
