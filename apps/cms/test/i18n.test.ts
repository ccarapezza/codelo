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
    // Un plural ICU —{n, plural, one {# …} other {# …}}— también interpola `n`,
    // y la variante de un idioma puede necesitarlo aunque la del otro lo
    // resuelva con {n} a secas. Sin contemplarlo, el test leía el plural como
    // "sin marcadores" y daba por buena una discrepancia real.
    const marcas = (s: string) =>
      [
        ...s.replace(/'\{\w+\}'/g, "").matchAll(/\{(\w+)\s*(?:,|\})/g),
      ]
        .map((m) => m[1])
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort();
    for (const k of Object.keys(es)) {
      expect(marcas(en[k]), `los marcadores de "${k}" no coinciden`).toEqual(marcas(es[k]));
    }
  });

  it("toda clave que el código usa existe en el catálogo", () => {
    // El agujero por el que se coló `marca.bg.label`: el código la pedía, el
    // catálogo no la tenía, y `t()` devuelve la entrada tal cual cuando no la
    // reconoce — así que la pantalla mostraba «marca.bg.label» como si fuera
    // una etiqueta. Sin error, sin aviso: sólo una captura lo delata.
    const dir = path.join(__dirname, "../src/admin");
    const archivos: string[] = [];
    const recorrer = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.tsx?$/.test(e.name)) archivos.push(p);
      }
    };
    recorrer(dir);

    const usadas = new Set<string>();
    for (const f of archivos) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/(?<![A-Za-z_$.])t\(\s*"([a-z][\w.]*\.[\w.]+)"/g)) usadas.add(m[1]);
      // claves guardadas como dato: `label: "marca.bg.label"`
      for (const m of src.matchAll(/(?:label|hint|que|description|texto):\s*"([a-z]+\.[\w.]+)"/g)) usadas.add(m[1]);
    }
    const huerfanas = [...usadas].filter((k) => !(k in es)).sort();
    expect(huerfanas).toEqual([]);
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
