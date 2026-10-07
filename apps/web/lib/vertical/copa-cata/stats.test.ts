// Las cifras de la Copa salen de estas funciones. Los fixtures usan nombres
// inventados: lo que se prueba es la regla (null ≠ 0, recurrencias por clave,
// familias, búsqueda sin tildes), no los datos reales — esos los cubre
// datos.test.ts.

import { describe, expect, it } from "vitest";
import {
  Q_MAXIMO,
  bancosMasPremiados,
  campeonDe,
  enNumeros,
  esCategoria,
  esFamilia,
  esObjeto,
  filtrarPremios,
  filtroDeParams,
  fold,
  ganadoresRecurrentes,
  geneticasRepetidas,
  materialDe,
  matrizCategorias,
  premiosPorCategoria,
  records,
  repartirPiezas,
  slug,
} from "./stats";
import type { Anio, Edicion, Grafica, Premio, TipoGrafica } from "./tipos";

const vacio = { valor: null, fuente: null };

const ed = (anio: Anio, p: Partial<Edicion> = {}): Edicion => ({
  anio,
  numero: 1,
  rotulo: "1ª",
  rotuloAlt: [],
  nombre: "Edición de prueba",
  etapa: "asociacion",
  fecha: `${anio}-07-01`,
  diaSemana: "domingo",
  fechaFuentes: ["f"],
  horaInicio: vacio,
  lugar: vacio,
  formato: [],
  categoriasTexto: vacio,
  muestras: vacio,
  participantes: vacio,
  cupo: vacio,
  mesas: vacio,
  entrada: vacio,
  marcas: { min: 1, max: 1, fuentes: ["f"] },
  jurado: null,
  palmares: { fuentes: ["f"] },
  cronica: null,
  heroGrafica: null,
  fuentes: ["f"],
  contradicciones: [],
  faltantes: [],
  ...p,
});

let n = 0;
const pr = (p: Partial<Premio> & Pick<Premio, "edicion" | "categoria">): Premio => ({
  id: `p-${++n}`,
  categoriaRotulo: "Categoría",
  puesto: null,
  premioRotulo: "Premio",
  ganador: "Alguien",
  ganadorTipo: "persona",
  ganadorClave: null,
  genetica: null,
  geneticaClave: null,
  banco: null,
  bancoClave: null,
  muestra: null,
  fuente: "f",
  ...p,
});

const SIN_REGISTRO = { fuentes: [] };

describe("fold y slug", () => {
  it("fold quita tildes, pasa a minúscula y colapsa espacios", () => {
    expect(fold("  Tío   Guille ")).toBe("tio guille");
    expect(fold("DESFRÁN")).toBe("desfran");
  });

  it("slug da la misma clave para grafías que solo difieren en tildes o signos", () => {
    expect(slug("Desfrán")).toBe(slug("Desfran"));
    expect(slug("L.A. Amnesia")).toBe("l-a-amnesia");
    expect(slug("Mac&Diré")).toBe("mac-dire");
  });
});

describe("premiosPorCategoria", () => {
  it("agrupa por familia y, dentro de cada una, de más a menos", () => {
    const r = premiosPorCategoria([
      pr({ edicion: 2019, categoria: "hash" }),
      pr({ edicion: 2019, categoria: "interior" }),
      pr({ edicion: 2019, categoria: "interior" }),
      pr({ edicion: 2019, categoria: "campeon" }),
      pr({ edicion: 2019, categoria: "mencion-otra" }),
      pr({ edicion: 2019, categoria: "rosin" }),
      pr({ edicion: 2019, categoria: "rosin" }),
    ]);
    expect(r).toEqual([
      { categoria: "interior", familia: "flor", premios: 2 },
      { categoria: "campeon", familia: "flor", premios: 1 },
      { categoria: "rosin", familia: "extracto", premios: 2 },
      { categoria: "hash", familia: "extracto", premios: 1 },
      { categoria: "mencion-otra", familia: "otro", premios: 1 },
    ]);
  });

  it("no lista categorías sin premios", () => {
    expect(premiosPorCategoria([])).toEqual([]);
  });
});

describe("geneticasRepetidas", () => {
  it("unifica grafías por clave y cuenta las ediciones", () => {
    const r = geneticasRepetidas([
      pr({ edicion: 2015, categoria: "mencion-jurado", genetica: "Desfrán", geneticaClave: "desfran" }),
      pr({ edicion: 2016, categoria: "mencion-otra", genetica: "Desfran", geneticaClave: "desfran" }),
      pr({ edicion: 2016, categoria: "interior", genetica: "Otra", geneticaClave: "otra" }),
    ]);
    // Empate de grafías (una vez cada una): gana la más reciente.
    expect(r).toEqual([
      { clave: "desfran", nombre: "Desfran", busqueda: "Desfran", premios: 2, ediciones: [2015, 2016] },
    ]);
  });

  it("no cuenta las filas sin clave, aunque el texto coincida", () => {
    const r = geneticasRepetidas([
      pr({ edicion: 2019, categoria: "rosin", genetica: "R18", geneticaClave: null }),
      pr({ edicion: 2019, categoria: "rosin", genetica: "R18", geneticaClave: null }),
    ]);
    expect(r).toEqual([]);
  });

  it("respeta el mínimo", () => {
    const filas = [pr({ edicion: 2022, categoria: "hash", genetica: "Una", geneticaClave: "una" })];
    expect(geneticasRepetidas(filas)).toEqual([]);
    expect(geneticasRepetidas(filas, 1)).toHaveLength(1);
  });
});

describe("ganadoresRecurrentes", () => {
  it("unifica por clave aunque el nombre publicado cambie", () => {
    const r = ganadoresRecurrentes([
      pr({ edicion: 2017, categoria: "flores-otra", ganador: "Nombre Apodo", ganadorClave: "apodo" }),
      pr({ edicion: 2018, categoria: "interior", ganador: "Apodo", ganadorClave: "apodo" }),
      pr({ edicion: 2019, categoria: "interior", ganador: "Apodo", ganadorClave: "apodo" }),
    ]);
    expect(r).toEqual([
      { clave: "apodo", nombre: "Apodo", busqueda: "Apodo", premios: 3, ediciones: [2017, 2018, 2019] },
    ]);
  });

  it("la búsqueda es lo común a todas las formas, para que el filtro las traiga todas", () => {
    const filas = [
      pr({ edicion: 2021, categoria: "exterior", ganador: "Nombre de Tal Grow", ganadorClave: "x" }),
      pr({ edicion: 2022, categoria: "hash", ganador: "Nombre Otra Marca", ganadorClave: "x" }),
    ];
    const [r] = ganadoresRecurrentes(filas);
    expect(r).toMatchObject({ nombre: "Nombre Otra Marca", busqueda: "Nombre" });
    expect(filtrarPremios(filas, { q: r.busqueda })).toEqual(filas);
  });

  it("nunca une por el texto: dos filas iguales sin clave son dos personas", () => {
    const r = ganadoresRecurrentes([
      pr({ edicion: 2016, categoria: "exterior", ganador: "Pablo" }),
      pr({ edicion: 2017, categoria: "campeon", ganador: "Pablo" }),
    ]);
    expect(r).toEqual([]);
  });

  it("un comercio con clave cuenta como cualquier ganador", () => {
    const r = ganadoresRecurrentes([
      pr({ edicion: 2021, categoria: "grow", ganador: "Un Grow", ganadorTipo: "comercio", ganadorClave: "un-grow" }),
      pr({ edicion: 2022, categoria: "grow", ganador: "Un Grow", ganadorTipo: "comercio", ganadorClave: "un-grow" }),
    ]);
    expect(r).toEqual([
      { clave: "un-grow", nombre: "Un Grow", busqueda: "Un Grow", premios: 2, ediciones: [2021, 2022] },
    ]);
  });

  it("ordena por premios y después por ediciones", () => {
    const r = ganadoresRecurrentes([
      pr({ edicion: 2019, categoria: "rosin", ganador: "Una", ganadorClave: "una" }),
      pr({ edicion: 2019, categoria: "hash", ganador: "Una", ganadorClave: "una" }),
      pr({ edicion: 2021, categoria: "interior", ganador: "Otra", ganadorClave: "otra" }),
      pr({ edicion: 2022, categoria: "interior", ganador: "Otra", ganadorClave: "otra" }),
      pr({ edicion: 2015, categoria: "campeon", ganador: "Tres", ganadorClave: "tres" }),
      pr({ edicion: 2019, categoria: "exterior", ganador: "Tres", ganadorClave: "tres" }),
      pr({ edicion: 2022, categoria: "hash", ganador: "Tres", ganadorClave: "tres" }),
    ]);
    expect(r.map((x) => x.clave)).toEqual(["tres", "otra", "una"]);
  });
});

describe("bancosMasPremiados", () => {
  it("agrupa por clave, ignora los datos en disputa y corta en el límite", () => {
    const filas = [
      pr({ edicion: 2021, categoria: "campeon", banco: "Banco A", bancoClave: "a" }),
      pr({ edicion: 2022, categoria: "exterior", banco: "Banco  A", bancoClave: "a" }),
      pr({ edicion: 2022, categoria: "interior", banco: "Banco B", bancoClave: "b" }),
      pr({ edicion: 2022, categoria: "exterior", banco: "Banco C", bancoClave: null }),
    ];
    expect(bancosMasPremiados(filas).map((b) => [b.clave, b.premios])).toEqual([
      ["a", 2],
      ["b", 1],
    ]);
    expect(bancosMasPremiados(filas, 1)).toHaveLength(1);
  });
});

describe("records", () => {
  it("cada récord es la punta de su lista, con sus copas", () => {
    const filas = [
      pr({ edicion: 2015, categoria: "campeon", ganador: "Ana", ganadorClave: "ana", genetica: "Uno", geneticaClave: "uno" }),
      pr({ edicion: 2016, categoria: "interior", ganador: "Ana Grow", ganadorClave: "ana", genetica: "Uno", geneticaClave: "uno", banco: "Banco", bancoClave: "b" }),
      pr({ edicion: 2016, categoria: "exterior", ganador: "Ana", ganadorClave: "ana", genetica: "Dos", geneticaClave: "dos", banco: "Banco", bancoClave: "b" }),
      pr({ edicion: 2017, categoria: "exterior", ganador: "Beto", ganadorClave: "beto", genetica: "Dos", geneticaClave: "dos" }),
      pr({ edicion: 2018, categoria: "interior", ganador: "Beto", ganadorClave: "beto", genetica: "Uno", geneticaClave: "uno" }),
    ];
    const r = records(filas);
    expect(r.ganador.map((x) => [x.clave, x.premios, x.ediciones])).toEqual([["ana", 3, [2015, 2016]]]);
    // Uno: 3 premios. Dos: 2. Va solo la punta.
    expect(r.genetica.map((x) => [x.clave, x.premios])).toEqual([["uno", 3]]);
    expect(r.banco.map((x) => [x.clave, x.premios])).toEqual([["b", 2]]);
  });

  it("si dos empatan en la punta, van los dos", () => {
    const filas = [
      pr({ edicion: 2015, categoria: "campeon", ganadorClave: "a", geneticaClave: "x", genetica: "X" }),
      pr({ edicion: 2016, categoria: "campeon", ganadorClave: "a", geneticaClave: "y", genetica: "Y" }),
      pr({ edicion: 2017, categoria: "campeon", ganadorClave: "b", geneticaClave: "x", genetica: "X" }),
      pr({ edicion: 2018, categoria: "campeon", ganadorClave: "b", geneticaClave: "y", genetica: "Y" }),
    ];
    expect(records(filas).ganador.map((x) => x.clave).sort()).toEqual(["a", "b"]);
    expect(records(filas).genetica.map((x) => x.clave).sort()).toEqual(["x", "y"]);
  });

  it("un récord necesita al menos dos premios: si nadie repite, no hay récord", () => {
    const filas = [
      pr({ edicion: 2015, categoria: "campeon", ganadorClave: "a", banco: "B", bancoClave: "b" }),
      pr({ edicion: 2016, categoria: "campeon", ganadorClave: "c", banco: "D", bancoClave: "d" }),
    ];
    expect(records(filas)).toEqual({ ganador: [], genetica: [], banco: [] });
    expect(records([])).toEqual({ ganador: [], genetica: [], banco: [] });
  });
});

describe("matrizCategorias", () => {
  it("solo tiene columnas para las ediciones que existieron, sin 2020", () => {
    const m = matrizCategorias([ed(2021), ed(2019)], [pr({ edicion: 2019, categoria: "rosin" })]);
    expect(m.anios).toEqual([2019, 2021]);
  });

  it("distingue 'no se premió' (0) de 'sin registro' (null)", () => {
    const m = matrizCategorias(
      [ed(2014, { palmares: SIN_REGISTRO }), ed(2015), ed(2016)],
      [pr({ edicion: 2015, categoria: "campeon" }), pr({ edicion: 2016, categoria: "interior" })],
    );
    const campeon = m.filas.find((f) => f.categoria === "campeon");
    expect(campeon?.celdas).toEqual([
      { anio: 2014, premios: null },
      { anio: 2015, premios: 1 },
      { anio: 2016, premios: 0 },
    ]);
    expect(m.filas.map((f) => f.categoria)).toEqual(["campeon", "interior"]);
  });
});

describe("enNumeros", () => {
  it("cuenta una clave una vez y cada fila sin clave —persona o comercio— como alguien distinto", () => {
    const r = enNumeros(
      [
        ed(2014, { marcas: { min: 6, max: 6, fuentes: ["f"] } }),
        ed(2019, { marcas: { min: 45, max: 45, fuentes: ["f"] } }),
        ed(2015, { marcas: { min: 10, max: 12, fuentes: ["f"] } }),
      ],
      [
        pr({ edicion: 2015, categoria: "campeon", ganadorClave: "tio", genetica: "Desfrán", geneticaClave: "desfran" }),
        pr({ edicion: 2019, categoria: "exterior", ganadorClave: "tio", genetica: "Desfran", geneticaClave: "desfran" }),
        pr({ edicion: 2019, categoria: "interior", ganador: "Pablo", genetica: "R18", geneticaClave: null }),
        pr({ edicion: 2019, categoria: "hash", ganador: "Pablo" }),
        pr({ edicion: 2019, categoria: "mencion-hash", ganador: "Un Comercio", ganadorTipo: "comercio" }),
      ],
    );
    expect(r).toEqual({
      ediciones: 3,
      premios: 5,
      geneticas: 1,
      ganadores: 4,
      marcas: { min: 6, max: 45 },
      desde: 2014,
      hasta: 2019,
    });
  });
});

describe("filtrarPremios", () => {
  const filas = [
    pr({ edicion: 2015, categoria: "mencion-jurado", ganador: "Tío Guille", genetica: "Desfrán" }),
    pr({ edicion: 2019, categoria: "rosin", ganador: "Una", categoriaRotulo: "Rosin" }),
    pr({ edicion: 2019, categoria: "hash", ganador: "Otra", genetica: "Lavender Jack" }),
    pr({ edicion: 2019, categoria: "interior", ganador: "Tercera", genetica: "Lavender" }),
    pr({ edicion: 2017, categoria: "extracciones", ganador: "Cuarta" }),
    pr({ edicion: 2021, categoria: "exterior", ganador: "Tío Guille", genetica: "Desfran", banco: "Banco A" }),
  ];

  it("filtra por año", () => {
    expect(filtrarPremios(filas, { anio: 2019 })).toHaveLength(3);
  });

  it("filtra por categoría", () => {
    expect(filtrarPremios(filas, { categoria: "hash" }).map((p) => p.ganador)).toEqual(["Otra"]);
  });

  it("una familia trae todas sus categorías: extracto = rosin + hash + extracciones", () => {
    const r = filtrarPremios(filas, { categoria: "extracto" });
    expect(r.map((p) => p.categoria)).toEqual(["rosin", "hash", "extracciones"]);
  });

  it("busca sin importar tildes ni mayúsculas", () => {
    expect(filtrarPremios(filas, { q: "desfran" })).toHaveLength(2);
    expect(filtrarPremios(filas, { q: "DESFRÁN" })).toHaveLength(2);
    expect(filtrarPremios(filas, { q: "tio guille" })).toHaveLength(2);
  });

  it("exige todas las palabras y busca también en el banco", () => {
    expect(filtrarPremios(filas, { q: "lavender jack" }).map((p) => p.ganador)).toEqual(["Otra"]);
    expect(filtrarPremios(filas, { q: "banco a" })).toHaveLength(1);
  });

  it("combina filtros y conserva el orden; sin filtros devuelve todo", () => {
    expect(filtrarPremios(filas, { anio: 2019, categoria: "flor", q: "lavender" })).toEqual([filas[3]]);
    expect(filtrarPremios(filas, { q: "   " })).toEqual(filas);
    expect(filtrarPremios(filas, {})).toEqual(filas);
  });
});

describe("esCategoria y esFamilia", () => {
  it("reconocen solo los valores del dominio", () => {
    expect(esCategoria("rosin")).toBe(true);
    expect(esCategoria("extracto")).toBe(false);
    expect(esFamilia("extracto")).toBe(true);
    expect(esFamilia("rosin")).toBe(false);
  });
});

describe("campeonDe", () => {
  it("devuelve el premio mayor de la edición, o null si no hay", () => {
    const filas = [
      pr({ edicion: 2019, categoria: "interior", ganador: "Una" }),
      pr({ edicion: 2019, categoria: "campeon", ganador: "Otra" }),
      pr({ edicion: 2021, categoria: "campeon", ganador: "Un Equipo", ganadorTipo: "comercio" }),
    ];
    expect(campeonDe(filas, 2019)?.ganador).toBe("Otra");
    expect(campeonDe(filas, 2021)?.ganador).toBe("Un Equipo");
    expect(campeonDe(filas, 2014)).toBeNull();
  });
});

describe("filtroDeParams", () => {
  const ANIOS: Anio[] = [2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022];

  it("lee año, categoría o familia y búsqueda", () => {
    expect(filtroDeParams({ anio: "2019", categoria: "extracto", q: "  desfran  " }, ANIOS)).toEqual({
      anio: 2019,
      categoria: "extracto",
      q: "desfran",
    });
    expect(filtroDeParams({ categoria: "rosin" }, ANIOS).categoria).toBe("rosin");
  });

  it("ignora lo inválido en vez de romper: 2020, «2019.0», una categoría inventada", () => {
    expect(filtroDeParams({ anio: "2020" }, ANIOS).anio).toBeNull();
    expect(filtroDeParams({ anio: "2019.0" }, ANIOS).anio).toBeNull();
    expect(filtroDeParams({ anio: "abc" }, ANIOS).anio).toBeNull();
    expect(filtroDeParams({ categoria: "inventada" }, ANIOS).categoria).toBeNull();
    expect(filtroDeParams({}, ANIOS)).toEqual({ anio: null, categoria: null, q: "" });
  });

  it("con un parámetro repetido vale el primero", () => {
    expect(filtroDeParams({ anio: ["2015", "2019"] }, ANIOS).anio).toBe(2015);
  });

  it("colapsa espacios y corta la búsqueda en el largo máximo", () => {
    expect(filtroDeParams({ q: "tío    guille" }, ANIOS).q).toBe("tío guille");
    expect(filtroDeParams({ q: "x".repeat(Q_MAXIMO + 50) }, ANIOS).q).toHaveLength(Q_MAXIMO);
  });
});

describe("objetos y gráficas planas", () => {
  const pieza = (id: string, tipo: TipoGrafica): Grafica => ({
    id,
    edicion: 2014,
    tipo,
    src: `/copa-cata/2014/${id}.webp`,
    width: 10,
    height: 10,
    alt: "Pieza de prueba",
    fuente: "f",
  });

  it("lo que pasó de mano en mano es objeto; afiches, flyers, logos y placas, no", () => {
    for (const t of ["credencial", "entrada", "sticker", "rotulo", "ficha-cata", "etiqueta-premio", "identificador-mesa"] as const) {
      expect(esObjeto(pieza("a", t)), t).toBe(true);
    }
    for (const t of ["afiche", "flyer", "logo", "placa-ganadores", "placa-sponsors"] as const) {
      expect(esObjeto(pieza("a", t)), t).toBe(false);
    }
  });

  it("cada objeto tiene su material: la credencial es plástico, el sticker vinilo, la entrada papel", () => {
    const material = (t: TipoGrafica) => {
      const g = pieza("a", t);
      if (!esObjeto(g)) throw new Error(t);
      return materialDe(g);
    };
    expect(material("credencial")).toBe("plastico");
    expect(material("sticker")).toBe("vinilo");
    expect(material("rotulo")).toBe("adhesivo");
    expect(material("entrada")).toBe("papel");
    expect(material("ficha-cata")).toBe("papel");
    expect(material("etiqueta-premio")).toBe("papel");
    expect(material("identificador-mesa")).toBe("carton");
  });

  it("un material propio manda sobre el del tipo: una credencial de papel no es plástico", () => {
    const g: Grafica = { ...pieza("tarjeta", "credencial"), material: "papel" };
    if (!esObjeto(g)) throw new Error("credencial");
    expect(materialDe(g)).toBe("papel");
  });

  it("reparte en dos grupos sin perder piezas y respetando el orden de los datos", () => {
    const { objetos, planas } = repartirPiezas([
      pieza("afiche", "afiche"),
      pieza("credencial-1", "credencial"),
      pieza("logo", "logo"),
      pieza("rotulo", "rotulo"),
      pieza("credencial-2", "credencial"),
    ]);
    expect(objetos.map((g) => g.id)).toEqual(["credencial-1", "rotulo", "credencial-2"]);
    expect(planas.map((g) => g.id)).toEqual(["afiche", "logo"]);
    expect(repartirPiezas([])).toEqual({ objetos: [], planas: [] });
  });
});
