// El texto corrido de la Copa: que celebre sin invitar a consumir, que cuente
// como información y no como duda (sin advertencias, sin notas de método, sin
// años sin Copa), y que las frases armadas con datos salgan bien con los datos
// reales: cada cifra y cada nombre tienen que venir de ediciones.ts y premios.ts.

import { describe, expect, it } from "vitest";
import { EDICIONES } from "./ediciones";
import { PREMIOS } from "./premios";
import { campeonDe, enNumeros } from "./stats";
import {
  BAJADA_PALMARES,
  FIGURAS,
  NUMEROS,
  PRIMERA_RONDA,
  RECORDS,
  SIN_RESULTADOS,
  bajadaEdicion,
  bajadaHome,
  bajadaPortada,
  cejaEdicion,
  cejaPalmares,
  cejaPortada,
  chipsEdicion,
  conteoPremios,
  enLetras,
  enumerar,
  firmaCronica,
  manifiesto,
  ordinal,
  palmaresCta,
  premiosEnAnios,
  premiosEnCopas,
  rotuloCredencialPortada,
  seoEdicion,
  seoPortada,
  verPremiosDe,
  type DatosBajada,
} from "./textos";
import type { Anio, Edicion } from "./tipos";

const numeros = enNumeros(EDICIONES, PREMIOS);
const de = (anio: Anio): Edicion => EDICIONES.find((e) => e.anio === anio)!;
const datos = (e: Edicion): DatosBajada => ({
  edicion: e,
  campeon: campeonDe(PREMIOS, e.anio),
  premios: PREMIOS.filter((p) => p.edicion === e.anio),
});
const bajada = (anio: Anio) => bajadaEdicion(datos(de(anio)));

function cadenas(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(cadenas);
  if (typeof valor === "function") return [];
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(cadenas);
  return [];
}

/** Todo lo que la sección imprime con palabras propias, con los datos reales. */
const TODO = cadenas([
  cejaPortada(numeros.ediciones, numeros.desde, numeros.hasta),
  bajadaPortada(numeros.ediciones),
  bajadaHome(numeros.ediciones),
  manifiesto(EDICIONES[0]),
  seoPortada(numeros.ediciones, numeros.desde, numeros.hasta),
  NUMEROS,
  RECORDS,
  RECORDS.premiosDe("Alguien"),
  premiosEnCopas(5, 4),
  premiosEnAnios(4, [2015, 2016, 2017, 2021]),
  palmaresCta(numeros.premios),
  PRIMERA_RONDA,
  EDICIONES.map(cejaEdicion),
  EDICIONES.map((e) => bajadaEdicion(datos(e))),
  EDICIONES.map((e) => seoEdicion(datos(e))),
  EDICIONES.map(chipsEdicion),
  EDICIONES.flatMap((e) => (e.cronica ? [firmaCronica(e.cronica.autor, e.cronica.fecha), e.cronica.cita] : [])),
  cejaPalmares(2015, 2022),
  BAJADA_PALMARES,
  SIN_RESULTADOS,
  conteoPremios(90, 7),
  verPremiosDe(2019),
  FIGURAS,
]);

describe("textos de la Copa", () => {
  it("celebran sin invitar a consumir ni convocar", () => {
    expect(
      TODO.filter((s) =>
        /pegaba|colocad|\befectos?\b|sumate|inscrib[ií]te|te esperamos|no te l[ao]s? pierdas|(?<!\p{L})vení(?!\p{L})/iu.test(s),
      ),
    ).toEqual([]);
  });

  it("cuentan como información: sin dudas, sin método y sin lo que no pasó", () => {
    expect(
      TODO.filter((s) =>
        /no hay registro|no consta|no se sabe|sin dato|sin registro|no figura|ninguna fuente|según (las|los|el|la)\b|\bfuentes?\b|9ª|novena|\b2020\b|\b2023\b|no se hizo|fue la última|disputa|dos versiones|no publicamos|nombre con el que compiti/i.test(
          s,
        ),
      ),
    ).toEqual([]);
  });

  it("no tienen cadenas vacías, espacios de más ni restos de plantilla", () => {
    expect(
      TODO.filter((s) => s.trim() === "" || s !== s.trim() || /\s{2,}|undefined|null|NaN|\$\{/.test(s)),
    ).toEqual([]);
  });

  it("la portada cuenta las ediciones en letras y el rango con raya", () => {
    expect(cejaPortada(numeros.ediciones, numeros.desde, numeros.hasta)).toBe("Ocho cosechas · 2014–2022");
    expect(bajadaPortada(numeros.ediciones)).toMatch(/^Durante ocho ediciones, el oeste se juntó a celebrar la cosecha/);
    expect(manifiesto(EDICIONES[0])[0]).toMatch(/^La Copa nació en 2014 como una cata entre socios/);
    expect(seoPortada(numeros.ediciones, numeros.desde, numeros.hasta).title).toBe(
      "Copa Cata del Oeste: ocho cosechas, 2014–2022",
    );
  });

  it("la home usa la primera frase de la portada, sin el cierre de la sección", () => {
    const home = bajadaHome(numeros.ediciones);
    expect(home).toBe(
      "Durante ocho ediciones, el oeste se juntó a celebrar la cosecha: cultivadores, mesas largas, frascos que pasaban de mano en mano y una copa que cada año encontraba nuevo dueño.",
    );
    expect(bajadaPortada(numeros.ediciones)).toBe(`${home} Esta es la historia de esa ronda.`);
  });

  it("hay una bajada por edición, con su número en palabras", () => {
    for (const e of EDICIONES) {
      const b = bajadaEdicion(datos(e));
      expect(b.length, `${e.anio}`).toBeGreaterThan(80);
      if (e.anio !== 2016) expect(b, `${e.anio}`).toContain(`La ${ordinal(e)} `);
    }
    expect(bajada(2016)).toContain("levantó la tercera");
  });

  it("las bajadas nombran al campeón y su genética tal como figuran en el palmarés", () => {
    for (const e of EDICIONES) {
      const c = campeonDe(PREMIOS, e.anio);
      if (!c) continue;
      const b = bajadaEdicion(datos(e));
      expect(b, `${e.anio}`).toContain(c.ganador);
      if (c.genetica) expect(b, `${e.anio}`).toContain(c.genetica);
    }
    // La forma publicada manda: con tilde, como en la placa.
    expect(bajada(2019)).toContain("Tío Bob se coronó con una San Fernando Lemon Kush");
    expect(bajada(2021)).toContain("la Mejor Planta fue para el Equipo de Sweedlab Seeds con una Mac & Fire");
    expect(bajada(2022)).toContain("Maury Heavens Fruit se llevó la Planta Campeona con una Chizito Mandarino");
  });

  it("las cifras de las bajadas salen de los datos", () => {
    const e19 = de(2019);
    expect(bajada(2019)).toContain(
      `${e19.muestras.valor} muestras, ${enLetras(e19.mesas.valor!)} mesas, ${e19.marcas.max} marcas acompañando`,
    );
    expect(bajada(2019)).toBe(
      "La sexta fue a lo grande: 63 muestras, diez mesas, 45 marcas acompañando y un jurado catando en paralelo. Tío Bob se coronó con una San Fernando Lemon Kush, y Rosin y Hash tuvieron su propio podio.",
    );
    const jurado = de(2021).jurado!;
    expect(jurado.flores.length + jurado.extracciones.length).toBe(10);
    expect(bajada(2021)).toContain("un jurado de diez");
    expect(PREMIOS.filter((p) => p.edicion === 2022)).toHaveLength(23);
    expect(bajada(2022)).toContain("23 premios");
    expect(bajada(2014)).toBe(
      "La primera fue íntima: una tarde de sábado en Flores, entre socios del grupo, con mesas compartidas y muestras que iban y venían. Ahí empezó todo.",
    );
  });

  it("lo que las bajadas afirman del formato coincide con el palmarés y la fecha", () => {
    const categorias = (anio: Anio) => new Set(PREMIOS.filter((p) => p.edicion === anio).map((p) => p.categoria));
    // 2015: campeón, segundo puesto, premio del jurado y menciones de mesa.
    expect([...categorias(2015)]).toEqual(expect.arrayContaining(["campeon", "flores-otra", "mencion-jurado", "mencion-mesa"]));
    expect(PREMIOS.some((p) => p.edicion === 2015 && p.categoria === "flores-otra" && p.puesto === 2)).toBe(true);
    // 2016: la primera con Interior y Exterior.
    expect([...categorias(2015)].some((c) => c === "interior" || c === "exterior")).toBe(false);
    expect([...categorias(2016)]).toEqual(expect.arrayContaining(["interior", "exterior"]));
    // 2017: podio de tres, extracciones y mejor presentación; el campeón, de exterior.
    expect(PREMIOS.filter((p) => p.edicion === 2017 && p.categoria === "flores-otra").map((p) => p.puesto)).toEqual([2, 3]);
    expect(PREMIOS.some((p) => p.edicion === 2017 && p.categoria === "extracciones")).toBe(true);
    expect(PREMIOS.some((p) => p.edicion === 2017 && /mejor presentación/i.test(p.premioRotulo))).toBe(true);
    expect(campeonDe(PREMIOS, 2017)?.nota).toMatch(/exterior/i);
    // 2018: la primera en domingo y la primera de la asociación civil.
    expect(EDICIONES.filter((e) => e.anio < 2018).every((e) => e.diaSemana === "sábado")).toBe(true);
    expect(de(2018).diaSemana).toBe("domingo");
    expect(EDICIONES.find((e) => e.etapa === "asociacion")?.anio).toBe(2018);
    // 2019: Rosin y Hash con podio de tres.
    expect(PREMIOS.filter((p) => p.edicion === 2019 && p.categoria === "rosin")).toHaveLength(3);
    expect(PREMIOS.filter((p) => p.edicion === 2019 && p.categoria === "hash")).toHaveLength(3);
    // 2021: en noviembre, con categoría Grow.
    expect(de(2021).fecha.slice(5, 7)).toBe("11");
    expect(categorias(2021).has("grow")).toBe(true);
  });

  it("los títulos para buscadores llevan el nombre y el año; la descripción es la bajada", () => {
    for (const e of EDICIONES) {
      const s = seoEdicion(datos(e));
      expect(s.title.startsWith(`${e.nombre} (${e.anio}): `), `${e.anio}`).toBe(true);
      expect(s.description).toBe(bajadaEdicion(datos(e)));
    }
  });

  it("los chips muestran solo lo que se sabe", () => {
    const claves = (anio: Anio) => chipsEdicion(de(anio)).map((c) => c.clave);
    // 2014: el cupo de la propuesta no fue el de la Copa, así que no se muestra.
    expect(claves(2014)).toEqual(["hora", "zona", "entrada", "marcas"]);
    expect(claves(2018)).toEqual(["hora", "marcas"]);
    expect(claves(2019)).toEqual(["hora", "zona", "muestras", "mesas", "entrada", "marcas"]);
    const texto = (anio: Anio, clave: string) => chipsEdicion(de(anio)).find((c) => c.clave === clave)?.texto;
    expect(texto(2019, "hora")).toBe("Domingo, desde las 12:00");
    expect(texto(2018, "hora")).toBe("Domingo");
    expect(texto(2014, "zona")).toBe("Flores, CABA");
    expect(texto(2017, "entrada")).toBe("Entrada: $400");
    expect(texto(2014, "entrada")).toBe("Entrada: la cuota mensual de socio ($50) más un bono de $50");
    // Las marcas: todas las que acompañaron, sumando lo que lista cada fuente.
    expect(texto(2021, "marcas")).toBe("36 marcas acompañaron");
    expect(texto(2021, "cupo")).toBe("Cupo de 100 personas");
  });

  it("la ceja de la edición lleva el nombre y la fecha", () => {
    expect(cejaEdicion(de(2019))).toBe("VI Copa Cata del Oeste · domingo 14/07/2019");
    expect(cejaEdicion(de(2016))).toBe("3ª Copa Cata del Oeste · sábado 16/07/2016");
  });

  it("las piezas chicas concuerdan en número y en lista", () => {
    expect(enLetras(8)).toBe("ocho");
    expect(enLetras(1)).toBe("una");
    expect(enLetras(1, false)).toBe("uno");
    expect(enLetras(10, false)).toBe("diez");
    expect(enLetras(45)).toBe("45");
    expect(enumerar([2021])).toBe("2021");
    expect(enumerar([2015, 2016, 2017, 2021])).toBe("2015, 2016, 2017 y 2021");
    expect(premiosEnCopas(5, 4)).toBe("5 premios en 4 copas");
    expect(premiosEnCopas(1, 1)).toBe("1 premio en 1 copa");
    expect(premiosEnAnios(4, [2021, 2022])).toBe("4 premios, en 2021 y 2022");
    expect(conteoPremios(1, 1)).toBe("1 premio · 1 edición");
    expect(conteoPremios(13, 2)).toBe("13 premios · 2 ediciones");
  });
});

describe("la credencial de la portada", () => {
  it("se rotula con el número y el año de la primera Copa", () => {
    expect(rotuloCredencialPortada(EDICIONES[0])).toBe("1ª Copa · 2014");
  });
});
