import { describe, expect, it } from "vitest";
import { consultaCaida, estadoBoletin, type BoletinSalud } from "./boletin-oficial";

const ahora = new Date("2026-10-28T12:00:00Z");

function salud(over: Partial<BoletinSalud>): BoletinSalud {
  return {
    ultimaConsulta: "2026-10-28T10:15:00Z",
    terminos: 5,
    fallidos: 0,
    error: null,
    ultimoExito: "2026-10-28T10:15:00Z",
    viaProxy: false,
    proxy: null,
    ...over,
  };
}

describe("estadoBoletin", () => {
  it("sin registro todavía: sin-datos, no un falso ok", () => {
    expect(estadoBoletin(null, ahora)).toBe("sin-datos");
  });

  it("todas respondieron: ok", () => {
    expect(estadoBoletin(salud({}), ahora)).toBe("ok");
  });

  it("fallaron todas: caido — el caso del 22-oct, que se veía como un día sin normas", () => {
    expect(
      estadoBoletin(salud({ fallidos: 5, error: "fetch failed (UND_ERR_CONNECT_TIMEOUT)" }), ahora),
    ).toBe("caido");
  });

  it("fallaron algunas: parcial", () => {
    expect(estadoBoletin(salud({ fallidos: 2 }), ahora)).toBe("parcial");
  });

  it("la última consulta es de hace más de dos días: atrasado", () => {
    expect(estadoBoletin(salud({ ultimaConsulta: "2026-10-26T08:00:00Z" }), ahora)).toBe("atrasado");
    // Un día y pico es el ritmo normal del cron diario.
    expect(estadoBoletin(salud({ ultimaConsulta: "2026-10-27T10:15:00Z" }), ahora)).toBe("ok");
  });

  it("caído pesa más que atrasado: es el problema que hay que ver primero", () => {
    expect(
      estadoBoletin(salud({ ultimaConsulta: "2026-10-20T10:15:00Z", fallidos: 5 }), ahora),
    ).toBe("caido");
  });
});

describe("consultaCaida", () => {
  it("sólo con TODAS las búsquedas fallidas", () => {
    const base = { terminos: 5, ultimoError: null, viaProxy: false, proxy: null };
    expect(consultaCaida({ ...base, fallidos: 5 })).toBe(true);
    expect(consultaCaida({ ...base, fallidos: 4 })).toBe(false);
  });

  it("sin términos configurados no hay nada caído", () => {
    expect(consultaCaida({ terminos: 0, fallidos: 0, ultimoError: null, viaProxy: false, proxy: null })).toBe(false);
  });
});
