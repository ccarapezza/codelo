import { describe, expect, it } from "vitest";
import { findEchoedHeadline, headlineTooSimilar } from "./headline-similarity";

// Los cinco pares son la tanda real del 2026-07-22 que motivó el módulo:
// tres calcos publicados y dos títulos legítimos sobre la misma noticia.
describe("headlineTooSimilar", () => {
  it("caza el calco casi literal (caso REPROCANN)", () => {
    expect(
      headlineTooSimilar(
        "Cómo renovar el REPROCANN paso a paso para 2026",
        "Cómo renovar el REPROCANN paso a paso: guía completa para 2026",
      ),
    ).toBe(true);
  });

  it("caza la paráfrasis mínima reordenada (caso Mendoza)", () => {
    expect(
      headlineTooSimilar(
        "Mendoza aprueba reglamentación para la investigación con cannabis y cáñamo",
        "Mendoza Reglamenta la Investigación con Cannabis y Cáñamo: Requisitos, Controles y Sanciones",
      ),
    ).toBe(true);
  });

  it("caza la frase núcleo compartida (caso precio del gramo)", () => {
    expect(
      headlineTooSimilar(
        "El precio del gramo de cannabis en Argentina en 2026 oscila entre $6.000 y $20.000",
        "Cuánto cuesta el gramo de cannabis en Argentina en 2026",
      ),
    ).toBe(true);
  });

  it("deja pasar mismo tema con ángulo propio (caso Ley de Semillas)", () => {
    expect(
      headlineTooSimilar(
        "Modificaciones a la Ley de Semillas afectan el uso propio de los agricultores",
        "Ley de Semillas bajo amenaza: el Gobierno a favor de las corporaciones del agronegocio",
      ),
    ).toBe(false);
  });

  it("deja pasar reencuadre con datos propios (caso LIBBY)", () => {
    expect(
      headlineTooSimilar(
        "Resultados preliminares del estudio LIBBY sugieren mejoras en la agitación por cannabis medicinal en pacientes con demencia",
        "El cannabis medicinal podría ayudar con la agitación de la demencia",
      ),
    ).toBe(false);
  });

  it("no explota con títulos vacíos o solo stopwords", () => {
    expect(headlineTooSimilar("", "Cualquier titular")).toBe(false);
    expect(headlineTooSimilar("Sobre el cómo y el cuándo", "Sobre el cómo y el cuándo")).toBe(false);
  });

  it("acentos y mayúsculas no cambian el veredicto", () => {
    expect(
      headlineTooSimilar(
        "CAÑAMO INDUSTRIAL: REGULACION NUEVA",
        "Cáñamo industrial: regulación nueva",
      ),
    ).toBe(true);
  });
});

describe("findEchoedHeadline", () => {
  it("devuelve el titular calcado de la lista", () => {
    const sources = [
      "Ley de Semillas bajo amenaza: el Gobierno a favor de las corporaciones del agronegocio",
      "Cómo renovar el REPROCANN paso a paso: guía completa para 2026",
    ];
    expect(
      findEchoedHeadline("Cómo renovar el REPROCANN paso a paso para 2026", sources),
    ).toBe(sources[1]);
    expect(findEchoedHeadline("Un título completamente original y propio", sources)).toBeNull();
  });
});
