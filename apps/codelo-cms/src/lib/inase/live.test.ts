// Live checks against INASE. Skipped unless INASE_LIVE=1, so CI and the normal
// `pnpm test` never depend on someone else's undocumented endpoint being up.
//
//   INASE_LIVE=1 pnpm --filter codelo-cms test
//
// Worth running after touching either sync module, and whenever the public
// search starts looking wrong: these are the assertions that tell "INASE changed
// something" apart from "we broke it".

import { describe, expect, it } from "vitest";
import { fetchAllRows, filterCannabis } from "./cultivares";
import { fetchOperadores } from "./operadores";
import { parseNumeroInscripcion } from "./parse";

const live = process.env.INASE_LIVE === "1";
const suite = live ? describe : describe.skip;

// The sync modules only use strapi.log, so a console shim is enough.
const fakeStrapi = {
  log: { info: console.log, warn: console.warn, error: console.error, debug: () => {} },
} as never;

suite("INASE en vivo", () => {
  it("el padrón RNCyFS trae los operadores esperados", async () => {
    const rows = await fetchOperadores(fakeStrapi);
    expect(rows.length).toBeGreaterThan(2500);

    // Verified 21/07/2026 — this is the operator printed on the Tropicana WFC
    // packet, and the end-to-end proof that label → padrón resolves.
    const cs = rows.find(r => r.numeroInscripcion.startsWith("13481"));
    expect(cs?.razonSocial).toMatch(/CS GROUP/);
    expect(cs?.provincia).toMatch(/TIERRA DEL FUEGO/);
    expect(parseNumeroInscripcion(cs!.numeroInscripcion).categorias).toEqual(["E", "F", "K1"]);

    // Accents must survive the latin1 decode.
    expect(rows.some(r => /Ñ/.test(r.razonSocial))).toBe(true);
    expect(rows.some(r => /�/.test(r.razonSocial))).toBe(false);
  }, 60_000);

  it("el catálogo trae los cultivares de cannabis con sus obtentores", async () => {
    const all = await fetchAllRows(fakeStrapi);
    expect(all.length).toBeGreaterThan(14_000);

    const cannabis = filterCannabis(all);
    // 67 on 21/07/2026. The band catches both a broken filter and a silent
    // truncation without failing every time INASE registers something new.
    expect(cannabis.length).toBeGreaterThan(50);
    expect(cannabis.length).toBeLessThan(500);

    // The three cultivars from the photographed packets.
    const byName = (n: string) => cannabis.find(c => c.nombre_definitivo === n);
    expect(byName("TROPICANA WFC")).toMatchObject({
      numero_registro: 21357,
      solicitante_rnc: "FACUNDO JAVIER MELIGENE",
    });
    expect(byName("PASTEL DE CHOQUE")?.numero_registro).toBe(21321);
    expect(byName("CRAIG")?.numero_registro).toBe(21855);
  }, // ~149 paginated requests with a 250 ms courtesy gap: about 6 minutes.
  900_000);
});
