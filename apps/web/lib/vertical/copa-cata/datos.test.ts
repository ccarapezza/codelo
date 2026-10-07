// Invariantes sobre los datos reales de la Copa Cata del Oeste.
//
// El riesgo acá no es un crash: es un apellido, una cuenta personal o un
// identificador privado publicado por descuido, o una cifra que no sale de
// ninguna fuente. Estos tests hacen fallar en voz alta lo que una revisión a
// ojo deja pasar. La guardia de nombres usa patrones genéricos —nunca
// apellidos reales— y la lista de formas de más de una palabra que alguien
// revisó a mano contra los originales.

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANIOS,
  ANIOS_CON_PREMIOS,
  CLAVES_GANADOR,
  EDICIONES,
  FUENTES,
  GRAFICAS,
  ILUSTRACION_EDICION,
  ILUSTRACION_PORTADA,
  MATERIAL_OBJETO,
  MEDIOS,
  ORIGENES_VIDEO,
  ORNAMENTOS,
  PREMIOS,
  TIPOS_GRAFICA,
  anioDeParam,
  anterior,
  diaDeLaSemana,
  enNumeros,
  esAnio,
  esCategoria,
  filtrarPremios,
  fold,
  fuente,
  ganadoresRecurrentes,
  geneticasRepetidas,
  esObjeto,
  getEdicion,
  graficasDe,
  materialDe,
  objetosDe,
  records,
  siguiente,
  slug,
} from "./index";
import type { Anio, Edicion } from "./tipos";

// Con el entorno jsdom, import.meta.url no es file://; vitest sí inyecta __dirname.
const AQUI = __dirname;
const PUBLIC = path.resolve(__dirname, "../../../public");
const WEB = path.resolve(__dirname, "../../..");
const MENSAJES = path.resolve(__dirname, "../../../messages/es.vertical.json");
const IDS_FUENTE = new Set(FUENTES.map((f) => f.id));
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Todas las fuentes que cita una edición, en cualquier campo. */
function citadas(e: Edicion): string[] {
  const campos = [
    e.horaInicio,
    e.lugar,
    e.categoriasTexto,
    e.muestras,
    e.participantes,
    e.cupo,
    e.mesas,
    e.entrada,
  ];
  return [
    ...e.fechaFuentes,
    ...campos.flatMap((c) => (c.fuente ? [c.fuente] : [])),
    ...e.formato.map((f) => f.fuente),
    ...e.marcas.fuentes,
    ...(e.jurado ? [e.jurado.fuente] : []),
    ...e.palmares.fuentes,
    ...(e.cronica ? [e.cronica.fuente] : []),
    ...e.contradicciones.flatMap((c) => c.versiones.map((v) => v.fuente)),
    ...PREMIOS.filter((p) => p.edicion === e.anio).map((p) => p.fuente),
  ];
}

/** Todas las cadenas de un valor, recorriéndolo entero. */
function cadenas(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(cadenas);
  if (valor && typeof valor === "object") return Object.values(valor).flatMap(cadenas);
  return [];
}

// ── Política de nombres ──────────────────────────────────────────────────

/**
 * Lo que nunca entra en un nombre publicado, en patrones genéricos: una
 * cuenta, un agregado entre paréntesis o una inicial de apellido. Ninguna
 * guardia lista apellidos reales: los originales están solo en el repo de
 * secretaría.
 */
const PROHIBIDO: Array<[string, RegExp]> = [
  ["un @usuario", /@/],
  ["paréntesis", /[()]/],
  ["una inicial de apellido", /\b[A-ZÁÉÍÓÚÑ]\.(\s|$)/],
];

/**
 * Formas publicadas de más de una palabra, revisadas una por una contra los
 * originales: el nombre con el que compitió cada uno, sin apellido ni cuenta
 * personal. Una forma nueva de dos o más palabras hace fallar el test hasta
 * que alguien la revise y la sume acá.
 */
const COMPUESTOS_REVISADOS = new Set([
  // Apodos y nombres compuestos.
  "Tío Guille",
  "Tío Bob",
  "Renata de las Flores",
  "Polaco de Caseros",
  "Emi Sativo",
  "Emi Indico",
  "Mati Pirata",
  "Mati Grower",
  "Lucas Skunk",
  "Nano Skunk",
  "Nico El Viejo",
  "El Bruja",
  "Juan Manuel",
  "Manu SinSolvente",
  "Tincho Pulgar Verde",
  "Tucho Bambulee",
  "Augusto LeGrower2.0",
  // Con su grow, su banco, su marca o su ciudad.
  "Nico Lugannabis",
  "Javi Lugannabis",
  "Pablo MDQ",
  "Carito MDQ",
  "Facu Fuzzy",
  "Guido Mantra",
  "Ruso LCDB",
  "Jhony de JamRock Grow Shop",
  "Alex de Green Monkey",
  "Bruno de Productos Mantra",
  "Juan de Buenos Aires Melts",
  "Guille de Naesa",
  "Mati de Cañuto Cañete Bariloche",
  "Julito de Castelar Grow Shop",
  "Pirata de Alquimia Organic",
  "Maury Heavens Fruit",
  "Rodri MDP Grower",
  "Ornella Heavens Fruit",
  "Jhony JamRock",
  "Fer Buenos Humos LP",
  "Bruno Melts",
  // Los comercios, grows y bancos que ganaron.
  "Alma Tierra",
  "Equipo de Sweedlab Seeds",
  "La Cueva del DF",
  "Quema2 Grow",
  "Satélite TDC",
  "Buenos Aires Melts",
]);

const GANADORES = PREMIOS.map((p) => p.ganador);
const JURADO = EDICIONES.flatMap((e) => (e.jurado ? [...e.jurado.flores, ...e.jurado.extracciones] : []));

function violaciones(nombre: string): string[] {
  return PROHIBIDO.filter(([, re]) => re.test(nombre)).map(([motivo]) => motivo);
}

describe("ediciones", () => {
  it("son ocho, de 2014 a 2022, sin 2020", () => {
    expect(EDICIONES.map((e) => e.anio)).toEqual([...ANIOS]);
    expect(EDICIONES.map((e) => e.anio as number)).not.toContain(2020);
  });

  it("numeran de 1 a 8 y no repiten rótulo", () => {
    expect(EDICIONES.map((e) => e.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(EDICIONES.map((e) => e.rotulo)).size).toBe(8);
  });

  it("la fecha es ISO, existe, es del año de la edición y coincide con el día de la semana", () => {
    for (const e of EDICIONES) {
      expect(e.fecha, `${e.anio}`).toMatch(ISO);
      expect(e.fecha.slice(0, 4)).toBe(String(e.anio));
      const [a, m, d] = e.fecha.split("-").map(Number);
      expect(DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()], `${e.anio}`).toBe(e.diaSemana);
      expect(diaDeLaSemana(e.fecha)).toBe(e.diaSemana);
    }
  });

  it("la etapa sigue a la fecha: grupo, constituida sin personería, asociación civil", () => {
    for (const e of EDICIONES) {
      const esperada =
        e.anio <= 2015 ? "grupo" : e.anio <= 2017 ? "constituida-sin-personeria" : "asociacion";
      expect(e.etapa, `${e.anio}`).toBe(esperada);
    }
  });

  it("del lugar publica solo la zona: sin números ni nombre de local", () => {
    for (const e of EDICIONES) {
      if (e.lugar.valor === null) continue;
      expect(e.lugar.valor, `${e.anio}`).toMatch(/^([A-ZÁÉÍÓÚ][a-záéíóúñ]+( [a-záéíóúñ]+)*, )?CABA$/);
    }
  });

  it("la hora es hh:mm o un hueco", () => {
    for (const e of EDICIONES) {
      if (e.horaInicio.valor !== null) expect(e.horaInicio.valor).toMatch(/^\d{2}:\d{2}$/);
    }
  });

  it("las cifras nunca son un cero que quiera decir 'no sé'", () => {
    for (const e of EDICIONES) {
      for (const c of [e.muestras, e.participantes, e.cupo, e.mesas]) {
        if (c.valor === null) continue;
        expect(Number.isInteger(c.valor) && c.valor > 0, `${e.anio}: ${c.valor}`).toBe(true);
        expect(c.fuente, `${e.anio}: cifra sin fuente`).not.toBeNull();
      }
    }
  });

  it("de los sponsors solo hay una cantidad, como rango válido", () => {
    for (const e of EDICIONES) {
      expect(Number.isInteger(e.marcas.min) && e.marcas.min > 0, `${e.anio}`).toBe(true);
      expect(e.marcas.max).toBeGreaterThanOrEqual(e.marcas.min);
      expect(e.marcas.fuentes.length, `${e.anio}`).toBeGreaterThan(0);
    }
    const rango = (anio: Anio) => {
      const { min, max } = getEdicion(anio).marcas;
      return [min, max];
    };
    // La crónica nombra 6; la credencial suma una marca que la crónica no nombra.
    expect(rango(2014)).toEqual([6, 7]);
    expect(rango(2015)).toEqual([10, 12]);
    expect(rango(2019)).toEqual([45, 45]);
    expect(rango(2021)).toEqual([33, 36]);
  });

  it("solo 2014 y 2015 tienen crónica, con su captura del Wayback", () => {
    expect(EDICIONES.filter((e) => e.cronica).map((e) => e.anio)).toEqual([2014, 2015]);
    for (const e of EDICIONES) {
      if (!e.cronica) continue;
      expect(e.cronica.wayback).toMatch(/^https:\/\/web\.archive\.org\/web\/\d{14}\//);
      expect(fuente(e.cronica.fuente)?.url).toBe(e.cronica.wayback);
      expect(e.cronica.fecha).toMatch(ISO);
    }
  });

  it("solo 2021 y 2022 tienen los nombres del jurado", () => {
    expect(EDICIONES.filter((e) => e.jurado).map((e) => e.anio)).toEqual([2021, 2022]);
  });

  it("la gráfica principal, si hay, existe, es de la misma edición y es plana, no un objeto", () => {
    for (const e of EDICIONES) {
      if (e.heroGrafica === null) continue;
      const g = GRAFICAS.find((x) => x.id === e.heroGrafica);
      expect(g?.edicion, `${e.anio}: ${e.heroGrafica}`).toBe(e.anio);
      expect(g && esObjeto(g), `${e.anio}: ${e.heroGrafica}`).toBe(false);
    }
    // Desde el 07/10/2026 la VI tiene su afiche, y el encabezado lo muestra en vez del logo.
    expect(getEdicion(2019).heroGrafica).toBe("2019-afiche");
  });

  it("2014 no tiene palmarés, y la ficha anota por qué", () => {
    const e = getEdicion(2014);
    expect(PREMIOS.filter((p) => p.edicion === 2014)).toEqual([]);
    expect(e.palmares.fuentes).toEqual([]);
    expect(e.faltantes.some((f) => f.startsWith("Ganadores"))).toBe(true);
    expect(ANIOS_CON_PREMIOS).toEqual(ANIOS.filter((a) => a !== 2014));
  });

  it("una edición sin fuentes de palmarés es una edición sin premios, y al revés", () => {
    for (const e of EDICIONES) {
      const tiene = PREMIOS.some((p) => p.edicion === e.anio);
      expect(e.palmares.fuentes.length > 0, `${e.anio}`).toBe(tiene);
    }
  });

  it("toda contradicción muestra al menos dos versiones", () => {
    for (const e of EDICIONES) {
      for (const c of e.contradicciones) {
        expect(c.versiones.length, `${e.anio}: ${c.tema}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("las contradicciones conocidas están cargadas con las dos versiones", () => {
    const texto = (anio: Anio) =>
      getEdicion(anio)
        .contradicciones.map((c) => [c.tema, ...c.versiones.map((v) => v.valor), c.nota].join(" | "))
        .join("\n");
    expect(texto(2016)).toContain("n° 21");
    expect(texto(2017)).toContain("76 asistentes");
    expect(texto(2017)).toContain("81 asistentes");
    expect(texto(2018)).toContain("14/07/2018");
    expect(texto(2018)).toContain("22/07/2018");
    expect(texto(2019)).toContain("R18");
    expect(texto(2019)).toContain("Sami");
    expect(texto(2022)).toContain("19 de julio");
    expect(texto(2022)).toContain("17/07/2022");
    expect(texto(2022)).toContain("4° puesto: banco");
    expect(texto(2022)).toContain("Mac&Diré");
    expect(texto(2022)).toContain("VII");
  });
});

describe("fuentes", () => {
  it("no repiten id", () => {
    expect(IDS_FUENTE.size).toBe(FUENTES.length);
  });

  it("toda fuente citada existe", () => {
    const todas = [
      ...EDICIONES.flatMap((e) => [...citadas(e), ...e.fuentes]),
      ...PREMIOS.map((p) => p.fuente),
      ...GRAFICAS.map((g) => g.fuente),
      ...MEDIOS.map((m) => m.fuente),
    ];
    const faltan = [...new Set(todas)].filter((id) => !IDS_FUENTE.has(id));
    expect(faltan).toEqual([]);
  });

  it("todo lo que cita una edición está en su lista de fuentes", () => {
    for (const e of EDICIONES) {
      const fuera = citadas(e).filter((id) => !e.fuentes.includes(id));
      expect([...new Set(fuera)], `${e.anio}`).toEqual([]);
    }
  });

  it("las URLs son solo públicas, y lo interno no lleva URL", () => {
    for (const f of FUENTES) {
      if (f.url !== null) {
        expect(f.url, f.id).toMatch(/^https:\/\/(www\.facebook\.com|www\.instagram\.com|web\.archive\.org)\//);
      }
      if (f.tipo === "archivo" || f.tipo === "correo") expect(f.url, f.id).toBeNull();
      if (f.tipo === "web-vieja") expect(f.url, f.id).toMatch(/^https:\/\/web\.archive\.org\//);
    }
  });

  it("las fechas son ISO", () => {
    for (const f of FUENTES) if (f.fecha !== null) expect(f.fecha, f.id).toMatch(ISO);
  });
});

describe("premios", () => {
  it("son 90: 10 + 9 + 7 + 8 + 13 + 20 + 23, y 2014 sin palmarés", () => {
    expect(PREMIOS).toHaveLength(90);
    expect(ANIOS.map((a) => [a, PREMIOS.filter((p) => p.edicion === a).length])).toEqual([
      [2014, 0],
      [2015, 10],
      [2016, 9],
      [2017, 7],
      [2018, 8],
      [2019, 13],
      [2021, 20],
      [2022, 23],
    ]);
  });

  it("tienen id único con el año adelante, edición y categoría válidas", () => {
    expect(new Set(PREMIOS.map((p) => p.id)).size).toBe(PREMIOS.length);
    for (const p of PREMIOS) {
      expect(p.id.startsWith(`${p.edicion}-`), p.id).toBe(true);
      expect(esAnio(p.edicion), p.id).toBe(true);
      expect(esCategoria(p.categoria), p.id).toBe(true);
      if (p.puesto !== null) expect(Number.isInteger(p.puesto) && p.puesto >= 1, p.id).toBe(true);
      if (p.muestra !== null) expect(p.muestra, p.id).toMatch(/^[MR]?\d+$/);
    }
  });

  it("todo premio nombra a quien lo ganó, también los seis que ganó un comercio", () => {
    for (const p of PREMIOS) expect(p.ganador.trim(), p.id).toBeTruthy();
    expect(PREMIOS.filter((p) => p.ganadorTipo === "comercio").map((p) => p.id)).toEqual([
      "2015-04",
      "2021-01",
      "2021-20",
      "2022-19",
      "2022-20",
      "2022-21",
    ]);
  });
});

describe("política de nombres", () => {
  it("ningún ganador ni jurado lleva usuario, paréntesis ni inicial de apellido", () => {
    const malos = [...GANADORES, ...JURADO]
      .map((n) => ({ n, por: violaciones(n) }))
      .filter((x) => x.por.length > 0);
    expect(malos).toEqual([]);
  });

  it("los nombres reales publicados pasan la guardia, con su grow o su marca", () => {
    for (const n of [
      "Mati Grower",
      "Lea182",
      "Tío Guille",
      "DF",
      "Quema2 Grow",
      "Augusto LeGrower2.0",
      "Jhony de JamRock Grow Shop",
      "Equipo de Sweedlab Seeds",
    ]) {
      expect(violaciones(n), n).toEqual([]);
    }
  });

  it("la guardia atrapa las formas que no se publican", () => {
    for (const n of ["Nombre @usuario", "Nombre (@usuario)", "@usuario", "Nombre A.", "Nombre (Tal)"]) {
      expect(violaciones(n).length, n).toBeGreaterThan(0);
    }
  });

  it("toda forma de más de una palabra fue revisada a mano, y no sobra ninguna", () => {
    const compuestos = new Set([...GANADORES, ...JURADO].filter((n) => /\s/.test(n)));
    expect([...compuestos].filter((n) => !COMPUESTOS_REVISADOS.has(n))).toEqual([]);
    expect([...COMPUESTOS_REVISADOS].filter((n) => !compuestos.has(n))).toEqual([]);
  });

  it("los textos alternativos de gráficas, medios e ilustraciones no nombran marcas ni cuentas", () => {
    const ilustraciones = [ILUSTRACION_PORTADA, ...Object.values(ILUSTRACION_EDICION)].map((i) => ({
      id: i.src,
      alt: i.alt,
    }));
    for (const x of [...GRAFICAS, ...MEDIOS, ...ilustraciones]) {
      expect(x.alt.trim(), x.id).toBeTruthy();
      expect(x.alt, x.id).not.toMatch(/@/);
      expect(x.alt, x.id).not.toMatch(/grow ?shop|\bseeds?\b|\bgenetics?\b/i);
    }
  });
});

describe("recurrencias", () => {
  const geneticas = geneticasRepetidas(PREMIOS);
  const ganadores = ganadoresRecurrentes(PREMIOS);

  it("Desfran: 4 premios, en 2015, 2016, 2017 y 2021", () => {
    expect(geneticas.find((g) => g.clave === "desfran")).toMatchObject({
      premios: 4,
      ediciones: [2015, 2016, 2017, 2021],
    });
  });

  it("CFK: 3 premios, en 2017, 2019 y 2021", () => {
    expect(geneticas.find((g) => g.clave === "cfk")).toMatchObject({
      premios: 3,
      ediciones: [2017, 2019, 2021],
    });
  });

  it("Tío Guille: 5 premios en 4 ediciones", () => {
    expect(ganadores.find((g) => g.clave === "tio-guille")).toEqual({
      clave: "tio-guille",
      nombre: "Tío Guille",
      busqueda: "Tío Guille",
      premios: 5,
      ediciones: [2015, 2019, 2021, 2022],
    });
  });

  it("Pirata: 4 premios, de la IV a la VII", () => {
    expect(ganadores.find((g) => g.clave === "pirata")).toMatchObject({
      nombre: "Pirata",
      premios: 4,
      ediciones: [2017, 2018, 2019, 2021],
    });
  });

  it("la búsqueda de cada recurrencia trae todos sus premios, aunque el nombre cambie de una edición a otra", () => {
    for (const r of ganadores) {
      const encontradas = filtrarPremios(PREMIOS, { q: r.busqueda });
      const propias = PREMIOS.filter((p) => p.ganadorClave === r.clave);
      expect(propias.filter((p) => !encontradas.includes(p)).map((p) => p.id), r.clave).toEqual([]);
    }
    for (const g of geneticas) {
      const encontradas = filtrarPremios(PREMIOS, { q: g.busqueda });
      const propias = PREMIOS.filter((p) => p.geneticaClave === g.clave);
      expect(propias.filter((p) => !encontradas.includes(p)).map((p) => p.id), g.clave).toEqual([]);
    }
    // Las dos formas de 2021 y 2022 no comparten la marca: la búsqueda es el nombre de pila.
    expect(ganadores.find((g) => g.clave === "bruno")?.busqueda).toBe("Bruno");
  });

  it("toda clave de ganador está justificada, se usa y une más de una fila", () => {
    const usadas = PREMIOS.flatMap((p) => (p.ganadorClave ? [p.ganadorClave] : []));
    expect([...new Set(usadas)].sort()).toEqual(Object.keys(CLAVES_GANADOR).sort());
    for (const clave of Object.keys(CLAVES_GANADOR)) {
      expect(usadas.filter((c) => c === clave).length, clave).toBeGreaterThanOrEqual(2);
    }
  });

  it("genética: misma clave ⇔ mismo nombre normalizado; sin genética, sin clave", () => {
    const conClave = PREMIOS.filter((p) => p.geneticaClave !== null);
    for (const p of conClave) expect(p.genetica, p.id).not.toBeNull();
    const nombres = new Map<string, Set<string>>();
    const claves = new Map<string, Set<string>>();
    for (const p of conClave) {
      const n = slug(p.genetica ?? "");
      nombres.set(p.geneticaClave!, (nombres.get(p.geneticaClave!) ?? new Set()).add(n));
      claves.set(n, (claves.get(n) ?? new Set()).add(p.geneticaClave!));
    }
    for (const [k, v] of nombres) expect(v.size, k).toBe(1);
    for (const [k, v] of claves) expect(v.size, k).toBe(1);
    // La única genética publicada que no se cuenta: "R18", que puede ser un número de muestra.
    expect(PREMIOS.filter((p) => p.genetica && !p.geneticaClave).map((p) => p.id)).toEqual(["2019-08"]);
  });

  it("banco: misma clave, mismo banco; el único sin clave es el que está en disputa", () => {
    const base = (b: string) =>
      fold(b)
        .replace(/[\s.]/g, "")
        .replace(/(seeds?|genetics?)$/, "");
    const porClave = new Map<string, Set<string>>();
    for (const p of PREMIOS) {
      if (p.banco === null) expect(p.bancoClave, p.id).toBeNull();
      if (p.banco === null || p.bancoClave === null) continue;
      porClave.set(p.bancoClave, (porClave.get(p.bancoClave) ?? new Set()).add(base(p.banco)));
    }
    for (const [k, v] of porClave) expect(v.size, k).toBe(1);
    expect(PREMIOS.filter((p) => p.banco && !p.bancoClave).map((p) => p.id)).toEqual(["2022-10"]);
  });

  it("en números: 8 ediciones, 90 premios, 75 genéticas, 73 ganadores, de 6 a 45 marcas", () => {
    // 73 = 11 claves + 62 filas sin clave, con los 6 comercios. Si una carga
    // nueva mueve estas cifras, la portada cambia: que sea a propósito.
    expect(enNumeros(EDICIONES, PREMIOS)).toEqual({
      ediciones: 8,
      premios: 90,
      geneticas: 75,
      ganadores: 73,
      marcas: { min: 6, max: 45 },
      desde: 2014,
      hasta: 2022,
    });
  });

  it("récords: Tío Guille, 5 premios en 4 copas; Desfran, 4 premios; el banco, Sweedlab, 4", () => {
    const r = records(PREMIOS);
    expect(r.ganador.map((x) => [x.clave, x.premios, x.ediciones.length])).toEqual([["tio-guille", 5, 4]]);
    expect(r.genetica.map((x) => [x.clave, x.premios, x.ediciones])).toEqual([["desfran", 4, [2015, 2016, 2017, 2021]]]);
    expect(r.banco.map((x) => [x.clave, x.premios, x.ediciones])).toEqual([["sweedlab", 4, [2021, 2022]]]);
  });

  it("repitieron premio once personas, encabezadas por Tío Guille y Pirata", () => {
    expect(ganadores.map((g) => [g.clave, g.premios])).toEqual([
      ["tio-guille", 5],
      ["pirata", 4],
      ["julito", 3],
      ["alejo", 2],
      ["bruno", 2],
      ["emi-sativo", 2],
      ["jhony", 2],
      ["mati-grower", 2],
      ["guido", 2],
      ["homero", 2],
      ["vasquito", 2],
    ]);
    expect(geneticas.map((g) => [g.clave, g.premios])).toEqual([
      ["desfran", 4],
      ["cfk", 3],
      ["l-a-amnesia", 2],
      ["og-solera", 2],
      ["chem-og", 2],
    ]);
  });
});

describe("textos publicados", () => {
  const TODO = cadenas([EDICIONES, PREMIOS, FUENTES, CLAVES_GANADOR, GRAFICAS]);

  it("no hay cadenas vacías ni con espacios de más: un hueco es null", () => {
    expect(TODO.filter((s) => s.trim() === "" || s !== s.trim())).toEqual([]);
  });

  it("cuentan sin celebrar el consumo", () => {
    // Sin tabú —la Copa se cuenta como lo que fue—, pero sin festejar efectos.
    expect(TODO.filter((s) => /pegaba|colocad|\befectos?\b/i.test(s))).toEqual([]);
  });

  it("la 9ª no se hizo: ningún dato dice que no consta", () => {
    expect(TODO.filter((s) => /no consta|no hay registro de que/i.test(s))).toEqual([]);
  });
});

describe("índice", () => {
  it("acepta solo años de cuatro dígitos con edición", () => {
    expect(anioDeParam("2019")).toBe(2019);
    expect(anioDeParam("2020")).toBeNull();
    expect(anioDeParam("2019.0")).toBeNull();
    expect(anioDeParam(" 2019")).toBeNull();
    expect(anioDeParam("abc")).toBeNull();
    expect(esAnio(2020)).toBe(false);
  });

  it("anterior y siguiente saltan 2020", () => {
    expect(anterior(2014)).toBeNull();
    expect(siguiente(2019)).toBe(2021);
    expect(anterior(2021)).toBe(2019);
    expect(siguiente(2022)).toBeNull();
  });
});

describe("gráficas", () => {
  it("cada src existe en public/, con id único, edición y fuente válidas", () => {
    expect(new Set(GRAFICAS.map((g) => g.id)).size).toBe(GRAFICAS.length);
    for (const g of GRAFICAS) {
      expect(fs.existsSync(path.join(PUBLIC, g.src)), g.src).toBe(true);
      expect(esAnio(g.edicion), g.id).toBe(true);
      expect(IDS_FUENTE.has(g.fuente), g.id).toBe(true);
      expect(g.width > 0 && g.height > 0, g.id).toBe(true);
    }
  });

  it("cada archivo mide lo que dice el módulo y va en la carpeta de su edición", () => {
    for (const g of GRAFICAS) {
      expect(medidasWebp(fs.readFileSync(path.join(PUBLIC, g.src))), g.src).toEqual({ width: g.width, height: g.height });
      expect(g.src.startsWith(`/copa-cata/${g.edicion}/${g.edicion}-`), g.src).toBe(true);
    }
  });

  it("el detalle, si lo hay, es corto y sin espacios de más", () => {
    for (const g of GRAFICAS) {
      if (g.detalle === undefined) continue;
      expect(g.detalle, g.id).toBe(g.detalle.trim());
      expect(g.detalle.length, g.id).toBeGreaterThan(0);
      expect(g.detalle.length, g.id).toBeLessThanOrEqual(32);
    }
  });
});

describe("objetos de la época", () => {
  it("credenciales: las dos plastificadas de la 1ª Copa y la de papel de la 8ª, y de ninguna otra edición", () => {
    const credenciales = GRAFICAS.filter((g) => g.tipo === "credencial");
    expect(credenciales.map((g) => [g.edicion, g.detalle, esObjeto(g) ? materialDe(g) : null])).toEqual([
      [2014, "Socio participante", "plastico"],
      [2014, "Socio/Invitado", "plastico"],
      [2022, "Participante", "papel"],
    ]);
  });

  it("un objeto declara su material solo cuando no es el de su tipo", () => {
    for (const g of GRAFICAS) {
      if (g.material === undefined) continue;
      expect(esObjeto(g), g.id).toBe(true);
      if (esObjeto(g)) expect(g.material, g.id).not.toBe(MATERIAL_OBJETO[g.tipo]);
    }
  });

  it("la credencial de 2022 imprime número y mote, y el mote es el de alguien del palmarés de 2022", () => {
    // La etiqueta original llevaba el nombre de quien la usaba y su QR: se reconstruyó vacía, con
    // el número y un mote que ya publica el palmarés (decisión de la Secretaría, 07/10/2026).
    const c = GRAFICAS.find((g) => g.id === "2022-credencial");
    const mote = /«#\d+ - ([^»]+)»/.exec(c?.alt ?? "")?.[1];
    expect(mote, "el alt cita la etiqueta como «#N - MOTE»").toBeDefined();
    const ganadores = PREMIOS.filter((p) => p.edicion === 2022).map((p) => fold(p.ganador));
    expect(ganadores).toContain(fold(mote ?? ""));
  });

  it("cada credencial plastificada trae alfa: el plástico tiene su forma, sin el blanco de la hoja en las esquinas", () => {
    for (const g of GRAFICAS.filter((x) => x.tipo === "credencial" && esObjeto(x) && materialDe(x) === "plastico")) {
      const buf = fs.readFileSync(path.join(PUBLIC, g.src));
      expect(buf.toString("ascii", 12, 16), g.src).toBe("VP8X");
      // Byte de banderas del VP8X: 0x10 es el canal alfa.
      expect(buf[20] & 0x10, g.src).toBe(0x10);
    }
  });

  it("ninguna pieza publicada arrastra EXIF ni perfil de color del original", () => {
    for (const g of GRAFICAS) {
      const buf = fs.readFileSync(path.join(PUBLIC, g.src));
      if (buf.toString("ascii", 12, 16) !== "VP8X") continue;
      // Banderas del VP8X: 0x20 perfil ICC, 0x08 EXIF, 0x04 XMP.
      expect(buf[20] & 0x2c, g.src).toBe(0);
    }
  });

  it("cada edición reparte sus piezas entre objetos y gráficas planas, sin perder ni repetir ninguna", () => {
    for (const anio of ANIOS) {
      const todas = GRAFICAS.filter((g) => g.edicion === anio).map((g) => g.id);
      const repartidas = [...objetosDe(anio), ...graficasDe(anio)].map((g) => g.id);
      expect([...repartidas].sort(), `${anio}`).toEqual([...todas].sort());
      for (const o of objetosDe(anio)) expect(MATERIAL_OBJETO[o.tipo], o.id).toBeTruthy();
    }
    expect(ANIOS.filter((a) => objetosDe(a).length > 0)).toEqual([2014, 2017, 2019, 2021, 2022]);
  });
});

/** Ancho y alto de un WebP leídos de su cabecera (VP8, VP8L o VP8X), sin dependencias. */
function medidasWebp(buf: Buffer): { width: number; height: number } {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error("no es un WebP");
  }
  const tipo = buf.toString("ascii", 12, 16);
  if (tipo === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (tipo === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (tipo === "VP8X") return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
  throw new Error(`WebP desconocido: ${tipo}`);
}

describe("ilustraciones", () => {
  const todas = [ILUSTRACION_PORTADA, ...Object.values(ILUSTRACION_EDICION), ...Object.values(ORNAMENTOS)];

  it("hay una por edición, y ninguna de más", () => {
    expect(Object.keys(ILUSTRACION_EDICION).map(Number)).toEqual([...ANIOS]);
    for (const a of ANIOS) expect(ILUSTRACION_EDICION[a].src, `${a}`).toBe(`/copa-cata/ilustraciones/edicion-${a}.webp`);
  });

  it("cada archivo existe y mide lo que dice el módulo", () => {
    for (const i of todas) {
      const archivo = path.join(PUBLIC, i.src);
      expect(fs.existsSync(archivo), i.src).toBe(true);
      expect(medidasWebp(fs.readFileSync(archivo)), i.src).toEqual({ width: i.width, height: i.height });
    }
  });

  it("las que cuentan algo tienen alt; los ornamentos son decoración y van vacíos", () => {
    for (const i of [ILUSTRACION_PORTADA, ...Object.values(ILUSTRACION_EDICION)]) {
      expect(i.alt.length, i.src).toBeGreaterThan(40);
    }
    for (const o of Object.values(ORNAMENTOS)) expect(o.alt, o.src).toBe("");
  });

  it("cada tarjeta para compartir tiene su ilustración en jpg, que es lo que satori lee", () => {
    const og = (nombre: string) => path.join(PUBLIC, "copa-cata", "og", `${nombre}.jpg`);
    expect(fs.existsSync(og("portada")), "portada").toBe(true);
    for (const a of ANIOS) expect(fs.existsSync(og(`ilustracion-${a}`)), `${a}`).toBe(true);
  });
});

describe("rótulos de la interfaz", () => {
  // next-intl avisa de una clave que falta recién al renderizar la página: acá
  // falla antes. Se prueba el dominio entero, no solo lo cargado (hoy no hay
  // videos en MEDIOS y ningún rótulo de origen se usa todavía).
  type Mensajes = { [clave: string]: string | Mensajes };
  const COPA = (JSON.parse(fs.readFileSync(MENSAJES, "utf8")) as { copa: Mensajes }).copa;

  /** El texto de `copa.<ruta>`, o `null` si falta o está vacío. */
  function rotulo(...ruta: string[]): string | null {
    let nodo: string | Mensajes | undefined = COPA;
    for (const k of ruta) nodo = typeof nodo === "object" ? nodo[k] : undefined;
    return typeof nodo === "string" && nodo.trim() !== "" ? nodo : null;
  }

  it("cada tipo de gráfica y cada origen de video tiene su rótulo", () => {
    const tipos = new Set<string>([...TIPOS_GRAFICA, ...GRAFICAS.map((g) => g.tipo)]);
    const origenes = new Set<string>([
      ...ORIGENES_VIDEO,
      ...MEDIOS.flatMap((m) => (m.tipo === "video" ? [m.origen] : [])),
    ]);
    const faltan = [
      ...[...tipos].filter((t) => !rotulo("graficas", t)).map((t) => `copa.graficas.${t}`),
      ...[...origenes].filter((o) => !rotulo("videos", o)).map((o) => `copa.videos.${o}`),
    ];
    expect(faltan).toEqual([]);
    expect(rotulo("graficas", "no-existe")).toBeNull();
  });

  it("toda clave fija que piden las páginas y los componentes existe", () => {
    // Las claves de `t("…")` y `t.raw("…")` escritas tal cual, contra el
    // namespace con que cada archivo pide sus traducciones. Las armadas con
    // datos (`graficas.${tipo}`, el origen de un video) las prueba el test de
    // arriba.
    const carpetas = [
      path.join(WEB, "app/[lang]/(vertical)/copa-cata"),
      path.join(WEB, "components/vertical/copa-cata"),
    ];
    const archivos = carpetas.flatMap((c) =>
      fs
        .readdirSync(c, { recursive: true, encoding: "utf8" })
        .filter((f) => f.endsWith(".tsx") && !f.endsWith(".test.tsx"))
        .map((f) => path.join(c, f)),
    );
    expect(archivos.length).toBeGreaterThan(8);
    const faltan: string[] = [];
    let usadas = 0;
    for (const archivo of archivos) {
      const texto = fs.readFileSync(archivo, "utf8");
      const ns = /getTranslations\(\s*(?:\{[^}]*namespace:\s*)?"([^"]+)"/.exec(texto)?.[1];
      if (!ns) continue;
      expect(ns.startsWith("copa"), archivo).toBe(true);
      for (const m of texto.matchAll(/\bt(?:\.raw)?\("([^"]+)"/g)) {
        usadas += 1;
        const ruta = [...ns.split(".").slice(1), ...m[1].split(".")];
        if (!rotulo(...ruta)) faltan.push(`${path.basename(archivo)}: copa.${ruta.join(".")}`);
      }
    }
    expect(usadas).toBeGreaterThan(20);
    expect(faltan).toEqual([]);
  });
});

describe("medios", () => {
  it("ids únicos, todo desde /cms/uploads/, con alt y fuente", () => {
    expect(new Set(MEDIOS.map((m) => m.id)).size).toBe(MEDIOS.length);
    for (const m of MEDIOS) {
      expect(m.url.startsWith("/cms/uploads/"), m.id).toBe(true);
      expect(m.alt.trim(), m.id).toBeTruthy();
      expect(esAnio(m.edicion), m.id).toBe(true);
      expect(IDS_FUENTE.has(m.fuente), m.id).toBe(true);
      if (m.tipo === "foto") {
        for (const f of Object.values(m.formats)) {
          if (f !== undefined) expect(f.startsWith("/cms/uploads/"), `${m.id}: ${f}`).toBe(true);
        }
      } else {
        expect(m.poster.startsWith("/cms/uploads/"), m.id).toBe(true);
        expect(m.duracion, m.id).toBeGreaterThan(0);
      }
    }
  });
});

describe("privacidad del código", () => {
  const PRIVADO: Array<[string, RegExp]> = [
    ["un enlace a Drive, Docs, Fotos o Gmail", /(drive|docs|photos|mail)\.google\.com|photos\.app\.goo\.gl/i],
    ["un id de hilo de correo", /\b(?=[0-9a-f]*[a-f])(?=[0-9a-f]*\d)[0-9a-f]{16}\b/],
    ["un id de archivo de Drive", /\b(?=[\w-]*[A-Z])(?=[\w-]*[a-z])(?=[\w-]*\d)[\w-]{19,}\b/],
    ["una dirección de correo", /[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
    // Documentos internos; las imágenes de public/ (webp, jpg de las OG) son públicas.
    ["un nombre de documento interno", /\.(pdf|docx?|xlsx?|psd)\b/i],
  ];

  it("ningún archivo de datos lleva enlaces, identificadores privados ni nombres de archivo", () => {
    const archivos = fs
      .readdirSync(AQUI)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(archivos.length).toBeGreaterThan(5);
    const hallazgos = archivos.flatMap((archivo) => {
      const texto = fs.readFileSync(path.join(AQUI, archivo), "utf8");
      return PRIVADO.filter(([, re]) => re.test(texto)).map(([que]) => `${archivo}: ${que}`);
    });
    expect(hallazgos).toEqual([]);
  });
});
