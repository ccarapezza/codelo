import { describe, expect, it, vi } from "vitest";

// La costura se mockea antes de importar: el test es del mecanismo, no de los
// enriquecedores de un vertical.
const costura: { anchorEnrichers: AnchorEnricher[] } = { anchorEnrichers: [] };
vi.mock("../verticals/anchor-enrichers", () => costura);

const { applyAnchorEnrichers } = await import("./anchor-enrichment");
const { generateImagePromptCandidates, resolvePromptConstraints } = await import("./openai");
const { capture } = await import("../../test/preservation/recorder");
import type { AnchorEnricher } from "./anchor-enrichment";

const ANCLAS = { topic: "cosecha", palette: "verde y ocre", venue: null };

describe("applyAnchorEnrichers", () => {
  it("sin enriquecedores no agrega ni descarta nada", () => {
    const r = applyAnchorEnrichers(ANCLAS);
    expect(r.lines).toEqual([]);
    expect([...r.drop]).toEqual([]);
  });

  it("junta las líneas y los descartes de cada enriquecedor", () => {
    const e: AnchorEnricher = (a) =>
      a.topic === "cosecha" ? { lines: ["- Signature: a wicker basket"], drop: ["palette"] } : null;
    const r = applyAnchorEnrichers(ANCLAS, [e]);
    expect(r.lines).toEqual(["- Signature: a wicker basket"]);
    expect([...r.drop]).toEqual(["palette"]);
  });

  it("uno que devuelve null no hace nada, y las líneas vacías se ignoran", () => {
    const r = applyAnchorEnrichers(ANCLAS, [() => null, () => ({ lines: ["  ", "- ok"] })]);
    expect(r.lines).toEqual(["- ok"]);
  });

  it("uno que lanza se ignora y los demás corren igual", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const roto: AnchorEnricher = () => {
      throw new Error("boom");
    };
    const r = applyAnchorEnrichers(ANCLAS, [roto, () => ({ lines: ["- sigue"] })]);
    expect(r.lines).toEqual(["- sigue"]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("en el prompt de imagen", () => {
  it("las líneas del vertical entran en MUST FEATURE y el ancla descartada no", async () => {
    costura.anchorEnrichers.push((a) =>
      a.topic ? { lines: ["- House signature: striped awning"], drop: ["palette"] } : null,
    );
    try {
      const anclas = { topic: "mercado", palette: "rojo y blanco", venue: null };
      const g = await capture((c) =>
        generateImagePromptCandidates(c, "m", "Título", "Bajada", {
          constraints: resolvePromptConstraints("semilla", anclas),
          recentDescriptions: [],
          candidates: 1,
        }),
      );
      expect(g.user).toContain("MUST FEATURE");
      expect(g.user).toContain("- House signature: striped awning");
      expect(g.user).toContain("mercado");
      expect(g.user).not.toContain("rojo y blanco");
    } finally {
      costura.anchorEnrichers.length = 0;
    }
  });
});
