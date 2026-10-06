// Las fechas de la Copa son días de calendario. El riesgo no es un error de
// tipeo: es que el domingo 14/07/2019 salga "sábado" en una máquina con otra
// zona horaria y nadie lo note. Por eso los tests corren en zonas extremas.

import { afterEach, describe, expect, it } from "vitest";
import { diaDeLaSemana, formatDuracion, formatFecha, formatFechaCorta } from "./formato";

const TZ_ORIGINAL = process.env.TZ;

afterEach(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ;
  else process.env.TZ = TZ_ORIGINAL;
});

describe("formatFecha", () => {
  it("antepone el día de la semana y usa dd/mm/aaaa", () => {
    process.env.TZ = "America/Argentina/Buenos_Aires";
    expect(formatFecha("2019-07-14")).toBe("domingo 14/07/2019");
    expect(formatFecha("2014-06-14")).toBe("sábado 14/06/2014");
  });

  it.each(["UTC", "America/Argentina/Buenos_Aires", "Pacific/Pago_Pago", "Pacific/Kiritimati"])(
    "no depende de la zona horaria (%s)",
    (tz) => {
      // Pago Pago está en UTC−11 y Kiritimati en UTC+14: un `new Date(iso).getDay()`
      // ingenuo da el día anterior o el siguiente en alguna de las dos.
      process.env.TZ = tz;
      expect(formatFecha("2019-07-14")).toBe("domingo 14/07/2019");
      expect(formatFecha("2022-07-17")).toBe("domingo 17/07/2022");
      expect(diaDeLaSemana("2016-07-16")).toBe("sábado");
    },
  );

  it("rechaza fechas inexistentes o mal formadas en vez de corregirlas", () => {
    expect(() => formatFecha("2019-02-30")).toThrow(RangeError);
    expect(() => formatFecha("14/07/2019")).toThrow(RangeError);
    expect(() => formatFecha("2019-7-14")).toThrow(RangeError);
  });
});

describe("formatFechaCorta", () => {
  it("rellena con ceros", () => {
    expect(formatFechaCorta("2018-07-02")).toBe("02/07/2018");
  });
});

describe("formatDuracion", () => {
  it("minutos y segundos, con horas solo si hacen falta", () => {
    expect(formatDuracion(45)).toBe("0:45");
    expect(formatDuracion(65)).toBe("1:05");
    expect(formatDuracion(59.6)).toBe("1:00");
    expect(formatDuracion(3725)).toBe("1:02:05");
  });

  it("rechaza una duración negativa o que no es un número", () => {
    expect(() => formatDuracion(-1)).toThrow(RangeError);
    expect(() => formatDuracion(Number.NaN)).toThrow(RangeError);
  });
});
