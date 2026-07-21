// The endpoint's failure mode is silence: an out-of-range `length`, or any
// change on INASE's side, returns HTTP 200 with `aaData: []` and
// `iTotalRecords: null`. Verified live on 21/07/2026:
//
//   length=100 -> HTTP 200 | iTotalRecords=14861 | 100 rows
//   length=200 -> HTTP 200 | iTotalRecords=null  |   0 rows
//
// An empty page is indistinguishable from "end of data" unless the count is
// checked, so these tests pin the guards that turn silence into a loud failure.
// Without them a bad run would mirror zero rows over a good catalogue.

import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllRows, filterCannabis, CONDICION_CANNABIS, type CncRow } from "./cultivares";

const fakeStrapi = {
  log: { info: () => {}, warn: () => {}, debug: () => {}, error: () => {} },
} as never;

function row(n: number, condicion: string | null = null): CncRow {
  return {
    id: n,
    numero_registro: n,
    nombre_definitivo: `CULTIVAR ${n}`,
    especie: "MAIZ",
    nombre_cientifico: "Zea mays L.",
    condicion_genetica: condicion,
    grupo_especie: "CE",
    inscripcion_rnc: "2020-01-01",
    inscripcion_rnpc: null,
    validez_rnpc: null,
    cod_pais: "ARG",
    solicitante_rnc: "",
    representante_rnc: "",
    solicitante_rnpc: null,
    representante_rnpc: null,
  };
}

/** Stub fetch with a canned sequence of page payloads. */
function mockPages(pages: Array<{ iTotalRecords: number | null; aaData: CncRow[] | null }>) {
  let call = 0;
  vi.stubGlobal("fetch", async () => {
    const body = pages[Math.min(call++, pages.length - 1)];
    return { ok: true, text: async () => JSON.stringify(body) } as Response;
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("fetchAllRows", () => {
  it("pages until it has the advertised total", async () => {
    mockPages([
      { iTotalRecords: 150, aaData: Array.from({ length: 100 }, (_, i) => row(i)) },
      { iTotalRecords: 150, aaData: Array.from({ length: 50 }, (_, i) => row(100 + i)) },
    ]);
    const rows = await fetchAllRows(fakeStrapi, { delayMs: 0 });
    expect(rows).toHaveLength(150);
  });

  it("throws when the first page is the silent-failure shape", async () => {
    // Exactly what length=200 returns today.
    mockPages([{ iTotalRecords: null, aaData: [] }]);
    await expect(fetchAllRows(fakeStrapi, { delayMs: 0 })).rejects.toThrow(/respuesta inesperada/);
  });

  it("throws when a later page comes back empty instead of truncating", async () => {
    // The dangerous case: page 1 is fine, page 2 silently returns nothing. A
    // naive loop would stop and report a 100-row catalogue as complete.
    mockPages([
      { iTotalRecords: 500, aaData: Array.from({ length: 100 }, (_, i) => row(i)) },
      { iTotalRecords: null, aaData: [] },
    ]);
    await expect(fetchAllRows(fakeStrapi, { delayMs: 0 })).rejects.toThrow(/página vacía/);
  });

  it("stops at the page cap instead of looping forever", async () => {
    // If INASE ever reports a total it will not serve, the loop must end loudly
    // rather than hammer the endpoint indefinitely.
    mockPages([{ iTotalRecords: 100_000, aaData: Array.from({ length: 100 }, (_, i) => row(i)) }]);
    await expect(fetchAllRows(fakeStrapi, { delayMs: 0, maxPages: 3 })).rejects.toThrow(
      /tope de 3 páginas/,
    );
  });
});

describe("filterCannabis", () => {
  it("keeps only rows carrying the Ley 27350 / 27669 marker", () => {
    const rows = [row(1), row(2, CONDICION_CANNABIS), row(3, "VARIEDADES")];
    expect(filterCannabis(rows).map(r => r.numero_registro)).toEqual([2]);
  });

  it("does not fall back to matching on especie", () => {
    // `especie` is spelled CANNABIS or CAÑAMO depending on the row, which is
    // why the marker is the discriminator. A row without it stays out.
    const loose = { ...row(9), especie: "CANNABIS" };
    expect(filterCannabis([loose])).toHaveLength(0);
  });
});
