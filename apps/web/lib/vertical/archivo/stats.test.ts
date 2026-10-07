// Funciones puras del archivo histórico, con notas de prueba: fechas, grupos,
// el filtro de la URL, la selección de la home, el filtro de la portada y
// adónde llevan las URL del sitio anterior.

import { describe, expect, it } from "vitest";
import {
  anioDe,
  conPreposicion,
  conteoPorTipo,
  cronologico,
  destinoUrlVieja,
  entrevistasParaHome,
  fechaCorta,
  listaDeTipos,
  porAnio,
  rangoViejo,
  sinNotasViejas,
  slugsViejos,
  tipoDeParam,
} from "./stats";
import type { NotaArchivo, TipoNota } from "./tipos";

const PORTADA = {
  src: "/archivo/portadas/cronica.webp",
  width: 1600,
  height: 893,
  alt: "Grabado",
  clase: "ilustracion" as const,
};

function nota(slug: string, fecha: string, extra: Partial<NotaArchivo> = {}): NotaArchivo {
  const tipo = extra.tipo ?? "cronica";
  return {
    slug,
    titulo: `Título de ${slug}`,
    excerpt: `Bajada de ${slug}`,
    autor: "Alguien",
    fecha,
    tipo,
    viejoId: 1,
    idsFusionados: [],
    entrevistado: null,
    portada: PORTADA,
    destacada: tipo === "entrevista",
    ...extra,
  };
}

describe("fechas", () => {
  it("el día es el que está escrito, en hora de Argentina, sin pasar por la zona de la máquina", () => {
    expect(fechaCorta("2014-08-05T02:32:33-03:00")).toBe("05/08/2014");
    expect(fechaCorta("2021-12-31T23:59:59-03:00")).toBe("31/12/2021");
    expect(anioDe("2021-12-31T23:59:59-03:00")).toBe(2021);
  });

  it("rechaza lo que no viene en el formato del manifiesto", () => {
    expect(() => fechaCorta("2014-08-05")).toThrow(RangeError);
    expect(() => fechaCorta("2014-08-05T05:32:33.000Z")).toThrow(RangeError);
  });
});

describe("orden y grupos", () => {
  const a = nota("a", "2015-03-01T10:00:00-03:00");
  const b = nota("b", "2014-08-05T03:07:33-03:00");
  const c = nota("c", "2014-08-05T02:32:33-03:00");
  const d = nota("d", "2015-03-01T10:00:00-03:00");

  it("cronológico: por fecha y, a igual fecha, por slug", () => {
    expect(cronologico([a, d, b, c]).map(n => n.slug)).toEqual(["c", "b", "a", "d"]);
  });

  it("por año: los años en orden, cada uno en orden cronológico", () => {
    expect(porAnio([a, b, c, d]).map(g => [g.anio, g.notas.map(n => n.slug)])).toEqual([
      [2014, ["c", "b"]],
      [2015, ["a", "d"]],
    ]);
  });

  it("el rango de años sale solo de las notas viejas", () => {
    const nueva = nota("n", "2026-10-06T00:00:00-03:00", { viejoId: null });
    expect(rangoViejo([a, b, nueva])).toEqual({ desde: 2014, hasta: 2015 });
    expect(rangoViejo([nueva])).toBeNull();
  });
});

describe("tipos", () => {
  const notas = [
    nota("e1", "2015-01-01T00:00:00-03:00", { tipo: "entrevista" }),
    nota("c1", "2014-01-01T00:00:00-03:00"),
    nota("e2", "2016-01-01T00:00:00-03:00", { tipo: "entrevista" }),
  ];

  it("el conteo sigue el orden del filtro y omite los tipos sin notas", () => {
    expect(conteoPorTipo(notas)).toEqual([
      { tipo: "entrevista", cantidad: 2 },
      { tipo: "cronica", cantidad: 1 },
    ]);
  });

  it("el filtro de la URL solo acepta un tipo con notas", () => {
    const hay: TipoNota[] = ["entrevista", "cronica"];
    expect(tipoDeParam("entrevista", hay)).toBe("entrevista");
    expect(tipoDeParam(["cronica", "entrevista"], hay)).toBe("cronica");
    expect(tipoDeParam("informe", hay)).toBeNull();
    expect(tipoDeParam("cualquiera", hay)).toBeNull();
    expect(tipoDeParam("", hay)).toBeNull();
    expect(tipoDeParam(undefined, hay)).toBeNull();
  });

  it("la lista de tipos se lee como frase", () => {
    const plural: Record<TipoNota, string> = {
      entrevista: "Entrevistas",
      cronica: "Crónicas",
      informe: "Informes",
      pronunciamiento: "Pronunciamientos",
      cronologia: "Cronología",
      investigacion: "Investigación",
    };
    expect(listaDeTipos(["cronica", "informe", "pronunciamiento"], t => plural[t])).toBe(
      "Crónicas, informes y pronunciamientos",
    );
    expect(listaDeTipos(["entrevista"], t => plural[t])).toBe("Entrevistas");
  });

  it("el entrevistado lleva su preposición", () => {
    expect(conPreposicion("Franco")).toBe("a Franco");
    expect(conPreposicion("Dr. Álvaro Sauri")).toBe("al Dr. Álvaro Sauri");
    expect(conPreposicion("Dra. Nombre")).toBe("a la Dra. Nombre");
    expect(conPreposicion("«El Pirata»")).toBe("a «El Pirata»");
  });
});

describe("la home", () => {
  const e = (slug: string, anio: number, autor: string) =>
    nota(slug, `${anio}-06-01T12:00:00-03:00`, { tipo: "entrevista", autor });

  it("una entrevista por entrevistador, la más reciente de cada uno, de la más nueva a la más vieja", () => {
    const notas = [
      e("a-2015", 2015, "A"),
      e("b-2017", 2017, "B"),
      e("c-2018", 2018, "C"),
      e("c-2019", 2019, "C"),
      e("a-2016", 2016, "A"),
    ];
    expect(entrevistasParaHome(notas).map(n => n.slug)).toEqual(["c-2019", "b-2017", "a-2016"]);
  });

  it("si no hay tres entrevistadores, completa con las más recientes", () => {
    const notas = [e("c-2018", 2018, "C"), e("c-2019", 2019, "C"), e("c-2017", 2017, "C")];
    expect(entrevistasParaHome(notas).map(n => n.slug)).toEqual(["c-2019", "c-2018", "c-2017"]);
    expect(entrevistasParaHome([e("x", 2015, "X")]).map(n => n.slug)).toEqual(["x"]);
  });

  it("no toma lo que no es entrevista destacada", () => {
    const notas = [nota("cronica", "2019-01-01T00:00:00-03:00"), e("a", 2015, "A")];
    expect(entrevistasParaHome(notas).map(n => n.slug)).toEqual(["a"]);
    expect(entrevistasParaHome([])).toEqual([]);
  });

  it("la portada saca las notas del sitio viejo y deja pasar las nuevas", () => {
    const vieja = nota("vieja", "2015-01-01T00:00:00-03:00", { viejoId: 10 });
    const nueva = nota("nueva", "2026-10-06T00:00:00-03:00", { viejoId: null });
    const viejos = slugsViejos([vieja, nueva]);
    expect([...viejos]).toEqual(["vieja"]);
    const posts = [{ slug: "otra" }, { slug: "vieja" }, { slug: "nueva" }, { slug: "otra-mas" }];
    expect(sinNotasViejas(posts, viejos).map(p => p.slug)).toEqual(["otra", "nueva", "otra-mas"]);
    expect(sinNotasViejas(posts, new Set())).toHaveLength(4);
  });
});

describe("URL del sitio anterior", () => {
  const notas = [
    nota("la-985", "2017-10-12T21:14:39-03:00", { viejoId: 985, idsFusionados: [987, 989] }),
    nota("la-10", "2014-08-05T02:32:33-03:00", { viejoId: 10 }),
    nota("nueva", "2026-10-06T00:00:00-03:00", { viejoId: null }),
  ];
  const destino = (url: string) => destinoUrlVieja(url.split("/").filter(Boolean), notas);

  it("un artículo del archivo va a su nota; uno fusionado, a la nota que lo contiene", () => {
    expect(destino("codeloweb/article/10")).toBe("/blog/la-10");
    expect(destino("codeloweb/article/985")).toBe("/blog/la-985");
    expect(destino("codeloweb/article/987")).toBe("/blog/la-985");
    expect(destino("codeloweb/article/989")).toBe("/blog/la-985");
    expect(destino("codeloweb/article/10/algo-mas")).toBe("/blog/la-10");
  });

  it("todo lo demás del sitio viejo va al archivo", () => {
    for (const url of [
      "codeloweb/article/12",
      "codeloweb/article/abc",
      "codeloweb/article/010x",
      "codeloweb/article",
      "codeloweb",
      "",
      "otra/article/10",
    ]) {
      expect(destino(url), url).toBe("/archivo");
    }
  });
});
