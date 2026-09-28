// El script de auditoría (scripts/find-echoed-titles.mjs) lleva una copia de
// la detección de calcos, porque un .mjs no puede importar el TS sin build. Una
// copia que diverge reporta calcos con un criterio que el motor ya no usa, y
// nadie se entera: esto las compara.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { headlineTooSimilar } from "../src/lib/headline-similarity";

const fuente = fs.readFileSync(path.join(__dirname, "../scripts/find-echoed-titles.mjs"), "utf8");
const inicio = fuente.indexOf("const STOPWORDS");
const fin = fuente.indexOf("// ── fin copia");
const copia = new Function(`${fuente.slice(inicio, fin)}; return similarity;`)() as (
  a: string,
  b: string,
) => { hit: boolean };

const PARES: Array<[string, string]> = [
  ["Mendoza Reglamenta la Investigación Sanitaria", "Mendoza aprueba reglamentación para la investigación sanitaria"],
  ["El Gobierno publicó la resolución del registro", "Qué cambia con la nueva resolución del registro nacional"],
  ["Una cooperativa obtuvo su licencia", "Una cooperativa obtuvo su licencia de producción"],
  ["La feria vuelve en noviembre", "Cómo se prepara la temporada de cosecha"],
  ["The new rules for growers explained", "New rules for growers: what changes"],
  ["", "Un titular cualquiera"],
];

describe("la copia del script coincide con el módulo", () => {
  it("encuentra el bloque copiado", () => {
    expect(inicio).toBeGreaterThan(0);
    expect(fin).toBeGreaterThan(inicio);
  });

  it.each(PARES)("«%s» vs «%s»", (a, b) => {
    expect(copia(a, b).hit).toBe(headlineTooSimilar(a, b));
  });
});
