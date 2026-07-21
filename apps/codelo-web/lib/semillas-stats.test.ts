// The panel's numbers come from these functions, so the fixture mirrors the real
// catalogue (67 cultivars as of 21/07/2026) and the assertions are the figures
// the page actually prints.

import { describe, expect, it } from "vitest";
import type { Cultivar } from "./semillas";
import { altasPorAnio, cobertura, porEspecie, porOrigen, topObtentores } from "./semillas-stats";

const c = (p: Partial<Cultivar>): Cultivar => ({
  numeroRegistro: 1,
  nombre: "X",
  especie: "CANNABIS",
  nombreCientifico: "Cannabis sativa L.",
  grupoEspecie: null,
  inscripcionRnc: null,
  inscripcionRnpc: null,
  validezRnpc: null,
  codPais: "ARG",
  solicitanteRnc: null,
  representanteRnc: null,
  solicitanteRnpc: null,
  representanteRnpc: null,
  ...p,
});

describe("altasPorAnio", () => {
  it("counts each registry separately", () => {
    const r = altasPorAnio([
      c({ inscripcionRnc: "2022-03-01" }),
      c({ inscripcionRnc: "2022-09-01", inscripcionRnpc: "2022-01-01" }),
      c({ inscripcionRnpc: "2023-05-01" }),
    ]);
    expect(r).toEqual([
      { anio: "2022", rnc: 2, rnpc: 1 },
      { anio: "2023", rnc: 0, rnpc: 1 },
    ]);
  });

  it("keeps a zero year instead of skipping it", () => {
    // The whole point of the chart: 2024 had no commercial registrations while
    // property titles kept flowing. A gap-filling bug would erase the story.
    const r = altasPorAnio([
      c({ inscripcionRnc: "2023-01-01" }),
      c({ inscripcionRnpc: "2024-06-01" }),
      c({ inscripcionRnc: "2025-01-01" }),
    ]);
    expect(r.map(x => x.anio)).toEqual(["2023", "2024", "2025"]);
    expect(r.find(x => x.anio === "2024")).toEqual({ anio: "2024", rnc: 0, rnpc: 1 });
  });

  it("ignores unparsable dates rather than bucketing them wrong", () => {
    expect(altasPorAnio([c({ inscripcionRnc: "" }), c({ inscripcionRnc: null })])).toEqual([]);
  });
});

describe("cobertura", () => {
  it("separates overlap from exclusives", () => {
    const r = cobertura([
      c({ inscripcionRnc: "2022-01-01" }),
      c({ inscripcionRnc: "2022-01-01", inscripcionRnpc: "2022-01-01" }),
      c({ inscripcionRnpc: "2022-01-01" }),
    ]);
    expect(r).toMatchObject({ conRnc: 2, conRnpc: 2, ambos: 1, soloRnc: 1, soloRnpc: 1, total: 3 });
  });

  it("never sums the two groups to more than the total by accident", () => {
    const rows = [c({ inscripcionRnc: "2022-01-01", inscripcionRnpc: "2022-01-01" })];
    const r = cobertura(rows);
    expect(r.soloRnc + r.soloRnpc + r.ambos).toBeLessThanOrEqual(r.total);
  });
});

describe("porEspecie", () => {
  it("ranks species by count", () => {
    const r = porEspecie([
      c({ especie: "CANNABIS" }),
      c({ especie: "CAÑAMO" }),
      c({ especie: "CANNABIS" }),
    ]);
    expect(r).toEqual([
      { etiqueta: "CANNABIS", valor: 2 },
      { etiqueta: "CAÑAMO", valor: 1 },
    ]);
  });

  it("buckets missing species instead of dropping the row", () => {
    expect(porEspecie([c({ especie: null })])).toEqual([{ etiqueta: "Sin especificar", valor: 1 }]);
  });
});

describe("topObtentores", () => {
  it("falls back to the RNPC applicant", () => {
    // 11 cultivars hold only a property title; ignoring them would under-count.
    const r = topObtentores([c({ solicitanteRnc: null, solicitanteRnpc: "CANSAT L" })]);
    expect(r).toEqual([{ etiqueta: "CANSAT L", valor: 1 }]);
  });

  it("ranks and truncates", () => {
    const rows = [
      ...Array(3).fill(c({ solicitanteRnc: "MAGA GENETICA S.A." })),
      ...Array(2).fill(c({ solicitanteRnc: "CONICET" })),
      c({ solicitanteRnc: "OTRO" }),
    ];
    expect(topObtentores(rows, 2)).toEqual([
      { etiqueta: "MAGA GENETICA S.A.", valor: 3 },
      { etiqueta: "CONICET", valor: 2 },
    ]);
  });

  it("skips rows with no breeder at all", () => {
    expect(topObtentores([c({ solicitanteRnc: "", solicitanteRnpc: null })])).toEqual([]);
  });
});

describe("porOrigen", () => {
  it("counts anything not ARG as imported", () => {
    expect(porOrigen([c({ codPais: "ARG" }), c({ codPais: "POL" }), c({ codPais: null })])).toEqual(
      {
        nacionales: 1,
        importados: 2,
      },
    );
  });
});
