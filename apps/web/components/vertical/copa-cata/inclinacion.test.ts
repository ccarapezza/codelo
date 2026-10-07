// La cuenta de la inclinación: el lado del puntero se hunde, el centro queda
// derecho, y un puntero que se sale del objeto (o un objeto sin medidas) no
// lo tuerce de más.

import { describe, expect, it } from "vitest";
import { INCLINACION_MAXIMA, inclinacion } from "./inclinacion";

const MARCO = { left: 100, top: 200, width: 240, height: 320 };

describe("inclinacion", () => {
  it("en el centro no inclina y el brillo queda al medio", () => {
    expect(inclinacion({ x: 220, y: 360 }, MARCO)).toEqual({ rx: 0, ry: 0, gx: 0.5, gy: 0.5 });
  });

  it("arriba a la izquierda hunde ese borde: rotateX positivo y rotateY negativo, al máximo", () => {
    expect(inclinacion({ x: 100, y: 200 }, MARCO)).toEqual({
      rx: INCLINACION_MAXIMA.x,
      ry: -INCLINACION_MAXIMA.y,
      gx: 0,
      gy: 0,
    });
  });

  it("abajo a la derecha, al revés", () => {
    expect(inclinacion({ x: 340, y: 520 }, MARCO)).toEqual({
      rx: -INCLINACION_MAXIMA.x,
      ry: INCLINACION_MAXIMA.y,
      gx: 1,
      gy: 1,
    });
  });

  it("un puntero afuera del objeto (sobre el rótulo de abajo) se acota al borde", () => {
    const r = inclinacion({ x: 400, y: 900 }, MARCO);
    expect(r.gx).toBe(1);
    expect(r.gy).toBe(1);
    expect(Math.abs(r.rx)).toBeLessThanOrEqual(INCLINACION_MAXIMA.x);
    expect(Math.abs(r.ry)).toBeLessThanOrEqual(INCLINACION_MAXIMA.y);
  });

  it("sin medidas (todavía sin dibujar) queda derecho, sin NaN", () => {
    expect(inclinacion({ x: 10, y: 10 }, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      rx: 0,
      ry: 0,
      gx: 0.5,
      gy: 0.5,
    });
  });

  it("redondea a centésimas de grado: las variables CSS no cargan decimales de más", () => {
    const r = inclinacion({ x: 177, y: 250 }, MARCO);
    for (const v of [r.rx, r.ry]) expect(Math.round(v * 100) / 100).toBe(v);
  });
});
