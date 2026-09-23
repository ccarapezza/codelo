// El contrato de los dos catálogos del panel.
//
// Existe porque las tres formas de romper esto son mudas:
//   · una clave en `es` y no en `en` → quien usa el panel en inglés ve español
//     y ni un aviso, porque `defaultMessage` es justamente el español;
//   · una clave en `en` y no en `es` → al revés, y peor: el castellano es la
//     fuente, así que esa cadena simplemente no existe;
//   · un valor vacío → la pantalla muestra un hueco.

import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const leer = (loc: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(__dirname, `../src/admin/translations/${loc}.json`), "utf8"));

const es = leer("es");
const en = leer("en");

describe("catálogos del panel", () => {
  it("tienen exactamente las mismas claves", () => {
    const soloEs = Object.keys(es).filter((k) => !(k in en));
    const soloEn = Object.keys(en).filter((k) => !(k in es));
    expect({ soloEs, soloEn }).toEqual({ soloEs: [], soloEn: [] });
  });

  it("ningún valor está vacío", () => {
    for (const [k, v] of Object.entries({ ...es, ...en })) {
      expect(v.trim(), `"${k}" está vacío`).not.toBe("");
    }
  });

  it("los marcadores {x} coinciden entre los dos idiomas", () => {
    // `t("setup.resumen", { fuentes })` interpola por nombre: si el inglés
    // escribe {sources} en vez de {fuentes}, react-intl deja el literal crudo
    // en pantalla. No tira error.
    // Las llaves ESCAPADAS —'{esto}'— no son marcadores: son texto ilustrativo
    // que muestra la plantilla del prompt. Sin escapar, react-intl las toma
    // como variables, no recibe valor y rompe el formateo de ese mensaje.
    const marcas = (s: string) =>
      [...s.replace(/'\{\w+\}'/g, "").matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(es)) {
      expect(marcas(en[k]), `los marcadores de "${k}" no coinciden`).toEqual(marcas(es[k]));
    }
  });

  it("el inglés no quedó en castellano", () => {
    // Una cadena larga idéntica en los dos idiomas es una que se copió sin
    // traducir. Las cortas sí pueden coincidir legítimamente («Nib», «Post»).
    const sospechosas = Object.keys(es).filter(
      (k) => es[k] === en[k] && es[k].length > 14 && /[áéíóúñ¿¡]|\b(el|los|las|que|para|con|una)\b/i.test(es[k]),
    );
    expect(sospechosas).toEqual([]);
  });
});
