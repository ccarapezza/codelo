// Lo que se testea acá es la DESCONFIANZA en la salida del modelo: la ficha se
// publica al lector, así que ningún campo puede llegar a la base tal como vino.
// Los casos raros (relevancia como string, "N/A" en vez de null, listas de más)
// son formas que devuelve el modelo de verdad, no hipótesis.

import { describe, expect, it } from "vitest";
import {
  analisisEsUtil,
  buildAnalisisPrompt,
  normalizeAnalisis,
  RELEVANCIA_MINIMA,
} from "./boletin-analisis";

const FICHA_OK = {
  relevancia: 3,
  relevanciaMotivo: "Modifica el régimen de inscripción de cultivares de cáñamo.",
  organismo: "INASE",
  resumen: "Habilita la inscripción de cultivares de cáñamo bajo un régimen simplificado.",
  queCambia: ["Crea la categoría X", "Deroga el artículo 4° de la Res. 100/2020"],
  aQuienAfecta: ["obtentores", "productores inscriptos"],
  vigencia: "a partir de los 30 días de su publicación",
  pasos: ["Presentar el formulario ante el INASE"],
  normasCitadas: ["Ley 27.669", "Resolución INASE 653/2023"],
};

describe("normalizeAnalisis", () => {
  it("deja pasar una ficha bien formada", () => {
    expect(normalizeAnalisis(FICHA_OK)).toEqual(FICHA_OK);
  });

  it("ante una relevancia ilegible asume 0, no un valor del medio", () => {
    // Un puntaje inventado hacia arriba publica basura; hacia abajo sólo deja la
    // norma archivada, que es recuperable con “re-analizar descartadas”.
    expect(normalizeAnalisis({}).relevancia).toBe(0);
    expect(normalizeAnalisis({ relevancia: "no aplica" }).relevancia).toBe(0);
    expect(normalizeAnalisis(null).relevancia).toBe(0);
  });

  it("clampea la relevancia al rango 0-3", () => {
    expect(normalizeAnalisis({ relevancia: 9 }).relevancia).toBe(3);
    expect(normalizeAnalisis({ relevancia: -2 }).relevancia).toBe(0);
    expect(normalizeAnalisis({ relevancia: 2.6 }).relevancia).toBe(3);
  });

  it("acepta la relevancia como string, que es como a veces vuelve", () => {
    expect(normalizeAnalisis({ relevancia: "2" }).relevancia).toBe(2);
  });

  it("convierte los null textuales en null de verdad", () => {
    // Sin esto, la web renderiza la palabra "N/A" como si fuera la vigencia de
    // la norma.
    for (const value of ["null", "N/A", "n/a", "No aplica", "sin datos", "ninguna"]) {
      expect(normalizeAnalisis({ vigencia: value }).vigencia).toBeNull();
    }
    expect(normalizeAnalisis({ vigencia: "   " }).vigencia).toBeNull();
  });

  it("no confunde una vigencia real con un null textual", () => {
    expect(normalizeAnalisis({ vigencia: "desde su publicación" }).vigencia).toBe(
      "desde su publicación",
    );
  });

  it("recorta las listas al tope de cada campo", () => {
    const largo = normalizeAnalisis({
      queCambia: ["a", "b", "c", "d", "e", "f", "g"],
      aQuienAfecta: ["1", "2", "3", "4", "5", "6"],
    });
    expect(largo.queCambia).toHaveLength(5);
    expect(largo.aQuienAfecta).toHaveLength(4);
  });

  it("descarta duplicados sin distinguir mayúsculas", () => {
    expect(normalizeAnalisis({ normasCitadas: ["Ley 27.669", "ley 27.669"] }).normasCitadas).toEqual(
      ["Ley 27.669"],
    );
  });

  it("tolera listas que vuelven como null o como string suelto", () => {
    expect(normalizeAnalisis({ pasos: null }).pasos).toEqual([]);
    expect(normalizeAnalisis({ pasos: "presentar el formulario" }).pasos).toEqual([]);
  });

  it("filtra los ítems vacíos de una lista", () => {
    expect(normalizeAnalisis({ queCambia: ["", "  ", "algo", null, 3] }).queCambia).toEqual(["algo"]);
  });

  it("trunca un resumen desbordado en vez de rechazarlo", () => {
    const { resumen } = normalizeAnalisis({ resumen: "x".repeat(5000) });
    expect(resumen!.length).toBeLessThanOrEqual(1201);
    expect(resumen!.endsWith("…")).toBe(true);
  });
});

describe("analisisEsUtil", () => {
  it("rechaza una norma relevante sin resumen", () => {
    // Es el campo que se muestra y el que se le pasa al Redactor: sin él la
    // ficha no sirve, así que se trata como fallo y se reintenta.
    const sinResumen = normalizeAnalisis({ ...FICHA_OK, resumen: null });
    expect(analisisEsUtil(sinResumen)).toBe(false);
  });

  it("acepta una descartada sin resumen", () => {
    const ruido = normalizeAnalisis({ relevancia: 0, relevanciaMotivo: "Designación de personal" });
    expect(ruido.relevancia).toBeLessThan(RELEVANCIA_MINIMA);
    expect(analisisEsUtil(ruido)).toBe(true);
  });
});

describe("buildAnalisisPrompt", () => {
  it("recorta el texto de la norma para no reventar el contexto", () => {
    const { user } = buildAnalisisPrompt("REGLAS", {
      titulo: "Resolución con anexos",
      texto: "y".repeat(120000),
    });
    expect(user.length).toBeLessThan(41000);
  });

  it("omite los encabezados que no tienen dato en vez de escribirlos vacíos", () => {
    const { user } = buildAnalisisPrompt("REGLAS", { titulo: "Sin rubro", texto: "texto" });
    expect(user).not.toContain("RUBRO:");
    expect(user).not.toContain("IDENTIFICACIÓN:");
    expect(user).toContain("TÍTULO: Sin rubro");
  });

  it("mete las instrucciones editables y la forma fija del JSON en el system", () => {
    const { system } = buildAnalisisPrompt("ESCALA CALIBRADA", {
      titulo: "t",
      texto: "x",
    });
    expect(system).toContain("ESCALA CALIBRADA");
    expect(system).toContain('"relevancia"');
  });
});
