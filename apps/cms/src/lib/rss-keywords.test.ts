// Regresión del bug que dejó al sitio 5 días sin publicar (31/07 → 04/08/2026).
//
// `getRecentNewsForTopic` arma un `$or` con todas las palabras del query y
// después recorta a las N más NUEVAS antes de puntuar. Con una sola stopword
// adentro el filtro deja de filtrar, el recorte se come todo lo que no sea de
// las últimas horas, y el Director —que consulta con el título del borrador,
// o sea prosa— nunca veía la fuente. Rechazaba por "hechos no respaldados".
//
// Medido contra producción: el query del borrador de abajo matcheaba 6.082
// filas con stopwords y 154 sin ellas, sobre un pool de 17.335.

import { describe, expect, it } from "vitest";
import { extractKeywords } from "./rss-fetcher";

describe("extractKeywords", () => {
  it("saca las stopwords del título de un borrador real", () => {
    // El borrador que disparó la investigación.
    const kw = extractKeywords("Mendoza define protocolos para la evaluación de iniciativas en energía y logística");
    expect(kw).not.toContain("para");
    expect(kw).toContain("mendoza");
    expect(kw).toContain("energía");
    expect(kw).toContain("logística");
  });

  it("saca las stopwords más dañinas", () => {
    // "para" y "sobre" son las que aparecían en casi todos los títulos.
    for (const w of ["para", "sobre", "como", "este", "entre", "desde", "también", "puede"]) {
      expect(extractKeywords(`palabra ${w} palabra`)).not.toContain(w);
    }
  });

  it("descarta números sueltos", () => {
    // Un año matchea cualquier nota del mismo año y no distingue nada.
    expect(extractKeywords("Cosecha 2026 en Mendoza")).toEqual(["cosecha", "mendoza"]);
  });

  it("conserva los términos temáticos aunque sean frecuentes", () => {
    const kw = extractKeywords("energía renovable, EOLICA y almacenamiento");
    expect(kw).toEqual(["energía", "renovable", "eolica", "almacenamiento"]);
  });

  it("parte por signos de puntuación, comillas y guiones largos", () => {
    // Los titulares vienen con comillas tipográficas y rayas; sin partirlas,
    // «turbina» quedaba pegado a la comilla y no matcheaba nunca.
    expect(extractKeywords('Fallo: «turbina» —mantenimiento, legal')).toEqual([
      "fallo",
      "turbina",
      "mantenimiento",
      "legal",
    ]);
  });

  it("devuelve vacío para el query ancho, que es el modo sin filtro", () => {
    expect(extractKeywords("")).toEqual([]);
  });

  it("deja el topic curado de un agente intacto", () => {
    // Los topics ya funcionaban: son palabras significativas. El arreglo no
    // debe recortarlos.
    const kw = extractKeywords("legales, regulación, normativa, ANSES, fallos judiciales");
    expect(kw).toEqual([
      "legales",
      "regulación",
      "normativa",
      "anses",
      "fallos",
      "judiciales",
    ]);
  });
});
