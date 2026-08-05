// La procedencia es lo que decide si una nota se publica o se descarta, así
// que lo que se testea acá es que sobreviva a datos hostiles: borradores viejos
// sin el campo, JSON con basura adentro, ítems sin URL.

import { describe, expect, it } from "vitest";
import { buildSourceContext, formatSourceContext, parseSourceContext } from "./source-context";
import type { NewsItem } from "./rss-fetcher";

const item = (over: Partial<NewsItem> = {}): NewsItem => ({
  title: "Mendoza definió el circuito para investigar cannabis",
  url: "https://revistathc.com/mendoza-cannabis",
  source: "[Cannabis] Revista THC",
  summary: "La provincia publicó los pasos para evaluar proyectos de investigación.",
  itemPublishedAt: null,
  ...over,
});

describe("buildSourceContext", () => {
  it("guarda una foto de la noticia, no una referencia", () => {
    // Es una foto a propósito: news-context se poda a los 7 días y hay
    // borradores que esperan más que eso en el pool.
    const [snap] = buildSourceContext([item()]);
    expect(snap).toEqual({
      title: "Mendoza definió el circuito para investigar cannabis",
      url: "https://revistathc.com/mendoza-cannabis",
      source: "[Cannabis] Revista THC",
      summary: "La provincia publicó los pasos para evaluar proyectos de investigación.",
    });
  });

  it("descarta ítems sin URL o sin título", () => {
    expect(buildSourceContext([item({ url: "" }), item({ title: "" })])).toEqual([]);
  });

  it("deduplica por URL", () => {
    expect(buildSourceContext([item(), item()])).toHaveLength(1);
  });

  it("corta a 10 ítems", () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      item({ url: `https://example.com/${i}` }),
    );
    expect(buildSourceContext(many)).toHaveLength(10);
  });

  it("colapsa los saltos de línea del resumen", () => {
    // Varios feeds traen HTML con saltos; sin normalizar, el bloque numerado
    // del prompt se rompe y el revisor pierde de vista dónde arranca cada ítem.
    const [snap] = buildSourceContext([item({ summary: "línea uno\n\n  línea dos" })]);
    expect(snap.summary).toBe("línea uno línea dos");
  });

  it("limpia el thumbnail HTML que mandan algunos feeds", () => {
    // Caso real: el summary de Revista THC para la nota de Mendoza era sólo un
    // <a><img>. Guardado tal cual, la evidencia del borrador era una etiqueta
    // de imagen y el revisor rechazaba igual.
    const [snap] = buildSourceContext([
      item({
        summary:
          '<a href="https://revistathc.com/x" title="Mendoza"><img width="300" src="http://x/y.jpg"/></a>',
      }),
    ]);
    expect(snap.summary).not.toContain("<");
    expect(snap.summary).not.toContain("img");
  });

  it("conserva el texto cuando el HTML lo envuelve", () => {
    const [snap] = buildSourceContext([
      item({ summary: "<p>La provincia public&oacute; los pasos.</p>" }),
    ]);
    expect(snap.summary).toBe("La provincia public&oacute; los pasos.");
  });

  it("tolera una lista vacía o inválida", () => {
    expect(buildSourceContext([])).toEqual([]);
    expect(buildSourceContext(undefined as never)).toEqual([]);
  });
});

describe("parseSourceContext", () => {
  it("devuelve vacío para los borradores anteriores al tracking", () => {
    // Este es el caso real de los ~10 borradores rechazados que ya existen:
    // el Director tiene que poder revisarlos igual, no romperse.
    expect(parseSourceContext(null)).toEqual([]);
    expect(parseSourceContext(undefined)).toEqual([]);
  });

  it("ignora JSON con forma inesperada", () => {
    expect(parseSourceContext("no soy una lista")).toEqual([]);
    expect(parseSourceContext({ url: "x" })).toEqual([]);
    expect(parseSourceContext([null, 3, "x", { sin: "url" }])).toEqual([]);
  });

  it("hace round-trip con lo que guardó buildSourceContext", () => {
    const saved = JSON.parse(JSON.stringify(buildSourceContext([item()])));
    expect(parseSourceContext(saved)).toEqual(buildSourceContext([item()]));
  });

  it("completa la fuente cuando falta", () => {
    const [snap] = parseSourceContext([{ title: "t", url: "https://x.com" }]);
    expect(snap.source).toBe("fuente desconocida");
    expect(snap.summary).toBe("");
  });
});

describe("formatSourceContext", () => {
  it("numera desde 1 y corta el resumen", () => {
    const out = formatSourceContext(buildSourceContext([item({ summary: "z".repeat(900) })]));
    expect(out.startsWith("[1] [Cannabis] Revista THC | Mendoza")).toBe(true);
    expect(out).toContain("z".repeat(600));
    expect(out).not.toContain("z".repeat(601));
  });

  it("permite continuar la numeración del bloque de relleno", () => {
    const out = formatSourceContext(buildSourceContext([item()]), 4);
    expect(out.startsWith("[4] ")).toBe(true);
  });

  it("devuelve vacío sin fuentes, para que el revisor use su fallback", () => {
    expect(formatSourceContext([])).toBe("");
  });
});
