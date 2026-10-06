// Palmarés de la Copa Cata del Oeste: una fila publicada = un `Premio`.
//
// De dónde sale cada edición: 2015, la crónica del sitio anterior; 2016,
// 2017, 2018, 2021 y 2022, las publicaciones de resultados de Facebook (la de
// 2021 trae además las placas de ganadores; la de 2022 se cotejó con la de
// Instagram); 2019, la placa de menciones. De 2014 no hay registro de
// ganadores.
//
// POLÍTICA DE NOMBRES (decisión del 05/10/2026, revisada el 06/10/2026):
// 1. Cada ganador va con el nombre con el que compitió, tal como figuró en
//    SU edición: apodo o nombre de pila, con su grow, su banco o su marca si
//    los usaba ("Nombre de Tal Grow Shop" queda entero).
// 2. Nunca apellidos ni iniciales de apellido ("Nombre A." → "Nombre"). Una
//    sigla que puede ser un apellido también se va. En la duda entre
//    apellido y marca, gana apellido: afuera.
// 3. Nunca cuentas personales: ningún @usuario entra al sitio. Si un grow
//    figura solo con su cuenta, va con su nombre ("@talgrow" → "Tal Grow").
// 4. Si quien ganó es un comercio, un grow, un banco o una marca, va su
//    nombre y `tipo: "comercio"`.
// 5. Organizadores, músicos y cocineros no se publican.
// 6. Las recurrencias se cuentan por `ganadorClave`, nunca por el texto, y
//    cada clave está justificada en `CLAVES_GANADOR`.
// La correspondencia original → publicado, con el motivo de cada recorte,
// vive en el repo privado de secretaría, que ya tiene los originales. Acá no
// queda ningún apellido ni cuenta personal.
//
// NORMALIZACIÓN (hecha a mano):
// - `categoriaRotulo` es la categoría con el nombre que le dio la fuente
//   ("Rosin Hash", "Mención de mesa"). Cuando la fuente publica un podio sin
//   categoría (2015 y 2017), dice "Podio general". `premioRotulo` es el
//   rótulo literal del premio, con mayúsculas y tildes unificadas.
// - "Campeón", "Campeón del Oeste", "Campeona", "Mejor Planta" y "Planta
//   Campeona" → `campeon`. El 2° y el 3° del podio general → `flores-otra`.
//   "Mención interior" y "Mención exterior" (2017) → `interior` y `exterior`
//   sin puesto. "Premio Jurados" y "Mención del jurado" → `mencion-jurado`.
//   "Mención Hash" → `mencion-hash`. "Mención de mesa" → `mencion-mesa`.
//   "Rosin Hash" y "Rosin Flor" (2022) → `rosin` con el rótulo intacto.
//   "Grow" y "Mención Grow" → `grow`. Las menciones sin categoría (2016),
//   "mejor presentación", "Equipo de Trabajo", "Crew", "flor del pueblo" y
//   "Armador profesional" → `mencion-otra`.
// - Genética y banco se separan donde la fuente pone " - ", " / " o ", ".
//   Una cruza entre paréntesis queda con la genética. Se unifican mayúsculas;
//   la ortografía no: un error de tipeo queda como se publicó y se anota.
// - `geneticaClave` sale del nombre sin tildes ni signos, salvo donde el dato
//   no es seguro (`null`: no se cuenta). `bancoClave` se escribe a mano.
// - Un dato en disputa lleva `nota` en la fila; la contradicción completa, en
//   `Edicion.contradicciones`.

import { slug } from "./stats";
import type { Anio, Categoria, Premio } from "./tipos";

/** Toda `ganadorClave` usada, con la razón para afirmar que es la misma persona. */
export const CLAVES_GANADOR: Record<string, string> = {
  "tio-guille": "Mismo apodo en las cuatro ediciones.",
  pirata: "En la IV Copa se lo publica como «Mati Pirata»; desde 2018, como «Pirata», y en 2021 con su marca.",
  julito: "Mismo nombre completo en las tres publicaciones.",
  "mati-grower": "Mismo apodo en 2021 y 2022.",
  jhony: "Mismo nombre y mismo comercio asociado en 2021 y 2022.",
  bruno:
    "Mismo nombre y mismo comercio asociado en 2021 y en la versión con etiquetas de 2022; el texto de 2022 lo publica con otra marca.",
  alejo: "Mismo nombre y mismo apellido, abreviado en 2019.",
  "emi-sativo": "Mismo apodo en 2015 y 2017.",
  homero: "Dos premios en la misma edición.",
  guido: "Dos premios en la misma edición.",
  vasquito: "Dos premios en la misma edición.",
};

type Base = {
  categoria: Categoria;
  categoriaRotulo: string;
  puesto?: number;
  premioRotulo: string;
  genetica?: string;
  /** Por defecto, `slug(genetica)`. `null` para no contarla. */
  geneticaClave?: string | null;
  banco?: string;
  bancoClave?: string | null;
  muestra?: string;
  nota?: string;
};

type Fila = Base & {
  ganador: string;
  /** Por defecto, "persona". */
  tipo?: "colectivo" | "comercio";
  clave?: string;
};

function palmares(anio: Anio, fuente: string, filas: Fila[]): Premio[] {
  return filas.map((f, i) => {
    if (f.banco !== undefined && f.bancoClave === undefined) {
      throw new Error(`premios ${anio}: falta bancoClave (o null) para "${f.banco}"`);
    }
    const premio: Premio = {
      id: `${anio}-${String(i + 1).padStart(2, "0")}`,
      edicion: anio,
      categoria: f.categoria,
      categoriaRotulo: f.categoriaRotulo,
      puesto: f.puesto ?? null,
      premioRotulo: f.premioRotulo,
      ganador: f.ganador,
      ganadorTipo: f.tipo ?? "persona",
      ganadorClave: f.clave ?? null,
      genetica: f.genetica ?? null,
      geneticaClave:
        f.geneticaClave !== undefined ? f.geneticaClave : f.genetica ? slug(f.genetica) : null,
      banco: f.banco ?? null,
      bancoClave: f.bancoClave ?? null,
      muestra: f.muestra ?? null,
      fuente,
    };
    return f.nota ? { ...premio, nota: f.nota } : premio;
  });
}

const MUESTRA_21 = "La publicación asigna la muestra n° 21 a dos premios; uno de los dos está mal.";
const SIN_PLACA =
  "La categoría Grow no tuvo placa: sale del texto de la publicación, que nombra al grow por su cuenta de Instagram.";

export const PREMIOS: Premio[] = [
  // ── 2015 · crónica del sitio anterior ─────────────────────────────────
  ...palmares(2015, "web-0187", [
    {
      categoria: "campeon",
      categoriaRotulo: "Campeón",
      premioRotulo: "Campeón 2015",
      ganador: "Beto",
      genetica: "Black Jack x White Satin x Herijuana",
      muestra: "17",
    },
    {
      categoria: "flores-otra",
      categoriaRotulo: "Podio general",
      puesto: 2,
      premioRotulo: "2do puesto",
      ganador: "Nico Lugannabis",
      genetica: "Ice Cool",
      muestra: "29",
    },
    {
      categoria: "mencion-jurado",
      categoriaRotulo: "Premio Jurados",
      premioRotulo: "Premio Jurados",
      ganador: "Tío Guille",
      clave: "tio-guille",
      genetica: "Desfrán",
      muestra: "19",
    },
    {
      categoria: "mencion-hash",
      categoriaRotulo: "Mención Hash",
      premioRotulo: "Mención Hash",
      ganador: "Alma Tierra",
      tipo: "comercio",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Chapi",
      genetica: "Marley Tribute",
      muestra: "26",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Renata de las Flores",
      genetica: "Amnesia Lemon",
      muestra: "3",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Pablo",
      genetica: "Moby MDQ",
      muestra: "24",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Martín",
      genetica: "Snowdawg8 x C99",
      muestra: "30",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Emi Sativo",
      clave: "emi-sativo",
      genetica: "Canalope",
      muestra: "11",
    },
    {
      categoria: "mencion-mesa",
      categoriaRotulo: "Mención de mesa",
      premioRotulo: "Mención de mesa",
      ganador: "Polaco de Caseros",
      genetica: "Minty Fruit",
      muestra: "8",
    },
  ]),

  // ── 2016 · Facebook, 19/07/2016 ──────────────────────────────────────
  ...palmares(2016, "fb-2016-07-19", [
    {
      categoria: "campeon",
      categoriaRotulo: "Campeón del Oeste",
      premioRotulo: "Campeón del Oeste",
      ganador: "Lea182",
      genetica: "Sugar Pop",
      banco: "Philosopher Seeds",
      bancoClave: "philosopher-seeds",
      muestra: "21",
      nota: MUESTRA_21,
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 1,
      premioRotulo: "1°",
      ganador: "Javi Lugannabis",
      genetica: "Super Lemon",
      muestra: "27",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 2,
      premioRotulo: "2°",
      ganador: "Nico",
      genetica: "BrotherHood OG",
      muestra: "26",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 1,
      premioRotulo: "1°",
      ganador: "Hernán",
      genetica: "Ganesh Spirit",
      muestra: "14",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 2,
      premioRotulo: "2°",
      ganador: "Pablo",
      genetica: "Blueberry",
      muestra: "4",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención",
      premioRotulo: "Mención",
      ganador: "Julio",
      genetica: "Jack Diesel",
      muestra: "21",
      nota: MUESTRA_21,
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención",
      premioRotulo: "Mención",
      ganador: "Martín",
      genetica: "Desfran",
      muestra: "25",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención",
      premioRotulo: "Mención",
      ganador: "Saúl",
      genetica: "Super Mauro",
      muestra: "36",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención",
      premioRotulo: "Mención",
      ganador: "Justin",
      genetica: "Withe Widow",
      muestra: "33",
      nota: "«Withe Widow», así en la publicación; probablemente White Widow.",
    },
  ]),

  // ── 2017 · Facebook, 18/07/2017 ──────────────────────────────────────
  ...palmares(2017, "fb-2017-07-18", [
    {
      categoria: "campeon",
      categoriaRotulo: "Campeón",
      premioRotulo: "Campeón",
      ganador: "Pablo",
      genetica: "Tahoe OG",
      nota: "Muestra de exterior.",
    },
    {
      categoria: "flores-otra",
      categoriaRotulo: "Podio general",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Mati Pirata",
      clave: "pirata",
      genetica: "L.A. Chocolate",
      nota: "Muestra de interior.",
    },
    {
      categoria: "flores-otra",
      categoriaRotulo: "Podio general",
      puesto: 3,
      premioRotulo: "3ro",
      ganador: "Ariel",
      genetica: "Pakistan",
      nota: "Muestra de interior.",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Mención interior",
      premioRotulo: "Mención interior",
      ganador: "Emi Sativo",
      clave: "emi-sativo",
      genetica: "CFK",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Mención exterior",
      premioRotulo: "Mención exterior",
      ganador: "Hernán",
      genetica: "Desfran",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención mejor presentación",
      premioRotulo: "Mención mejor presentación",
      ganador: "Pablo MDQ",
      genetica: "Strawberry Cough",
      nota: "Muestra de interior. No es el campeón de esta edición: la publicación los distingue.",
    },
    {
      categoria: "extracciones",
      categoriaRotulo: "Extracciones",
      premioRotulo: "Extracciones",
      ganador: "Carito MDQ",
      genetica: "Super Cheese",
    },
  ]),

  // ── 2018 · Facebook, 23/07/2018 ──────────────────────────────────────
  ...palmares(2018, "fb-2018-07-23", [
    {
      categoria: "campeon",
      categoriaRotulo: "Campeón",
      premioRotulo: "Campeón",
      ganador: "Tincho",
      genetica: "Purple LA",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 1,
      premioRotulo: "1ro Int",
      ganador: "Pirata",
      clave: "pirata",
      genetica: "Sensi Star",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 2,
      premioRotulo: "2do Int",
      ganador: "Lucas Skunk",
      genetica: "Moby GHS",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 1,
      premioRotulo: "1ro Ext",
      ganador: "Emanuel",
      genetica: "Skunk XL",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 2,
      premioRotulo: "2do Ext",
      ganador: "Tucho",
      genetica: "Critical Jack",
    },
    {
      categoria: "mencion-jurado",
      categoriaRotulo: "Mención del jurado",
      premioRotulo: "Mención jurado",
      ganador: "Juan Manuel",
      genetica: "Crit 2.0",
    },
    {
      categoria: "extracciones",
      categoriaRotulo: "Extracciones",
      puesto: 1,
      premioRotulo: "1er pto Extracciones",
      ganador: "Facu Fuzzy",
      genetica: "Tangie",
    },
    {
      categoria: "extracciones",
      categoriaRotulo: "Extracciones",
      puesto: 2,
      premioRotulo: "2do pto Extracciones",
      ganador: "Félix",
      genetica: "Chemfire",
    },
  ]),

  // ── 2019 · placa de menciones ────────────────────────────────────────
  ...palmares(2019, "placa-menciones-2019", [
    {
      categoria: "campeon",
      categoriaRotulo: "Flores",
      premioRotulo: "Campeona",
      ganador: "Tío Bob",
      genetica: "San Fernando Lemon Kush",
      muestra: "M45",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 1,
      premioRotulo: "1er puesto",
      ganador: "Talla",
      genetica: "Lavender",
      muestra: "M36",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 2,
      premioRotulo: "2do puesto",
      ganador: "Pirata",
      clave: "pirata",
      genetica: "Orange Bubba",
      muestra: "M29",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 3,
      premioRotulo: "3ro puesto",
      ganador: "Julito",
      clave: "julito",
      genetica: "Amherst SD",
      muestra: "M40",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 1,
      premioRotulo: "1er puesto",
      ganador: "Tío Guille",
      clave: "tio-guille",
      genetica: "Sweet Amnesia Haze",
      muestra: "M37",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 2,
      premioRotulo: "2do puesto",
      ganador: "Fede",
      genetica: "CFK",
      muestra: "M28",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 3,
      premioRotulo: "3er puesto",
      ganador: "Guido Mantra",
      clave: "guido",
      genetica: "Obama",
      muestra: "M4",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 1,
      premioRotulo: "1er puesto",
      ganador: "Homero",
      clave: "homero",
      genetica: "R18",
      geneticaClave: null,
      nota: "La placa pone «R18» en el lugar de la genética. Puede ser el número de muestra; por eso no se cuenta entre las genéticas.",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 2,
      premioRotulo: "2do puesto",
      ganador: "Guido Mantra",
      clave: "guido",
      genetica: "Jack",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 3,
      premioRotulo: "3er puesto",
      ganador: "Alejo",
      clave: "alejo",
      genetica: "Jack Herer",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 1,
      premioRotulo: "1er puesto",
      ganador: "Homero",
      clave: "homero",
      genetica: "Lavender Jack (dry sift)",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 2,
      premioRotulo: "2do puesto",
      ganador: "Sam",
      genetica: "707 Headbang Sour46 GSC (FOH)",
      nota: "Otra versión de la placa, leída de forma automática, dice «Sami».",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 3,
      premioRotulo: "3er puesto",
      ganador: "Ruso LCDB",
      genetica: "FrutiChronic (Bubble)",
    },
  ]),

  // ── 2021 · Facebook, 10/11/2021 (texto y placas) ─────────────────────
  ...palmares(2021, "fb-2021-11-10", [
    {
      categoria: "campeon",
      categoriaRotulo: "Mejor Planta",
      premioRotulo: "Mejor Planta",
      ganador: "Equipo de Sweedlab Seeds",
      tipo: "comercio",
      genetica: "Mac & Fire",
      banco: "Sweedlab",
      bancoClave: "sweedlab",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 1,
      premioRotulo: "1ro",
      ganador: "Mati Grower",
      clave: "mati-grower",
      genetica: "Orange Cookies",
      banco: "Limited Edition Seeds",
      bancoClave: "limited-edition-seeds",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Jhony de JamRock Grow Shop",
      clave: "jhony",
      genetica: "Love Shake (Sherbet Gelato x Black Sour)",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 3,
      premioRotulo: "3ro",
      ganador: "Vasquito",
      clave: "vasquito",
      genetica: "Karma OG",
      banco: "RafaK",
      bancoClave: "rafak",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 4,
      premioRotulo: "4to",
      ganador: "Lucas",
      genetica: "Skywalker x 24k",
      banco: "MJJ",
      bancoClave: "mjj",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 5,
      premioRotulo: "5to",
      ganador: "Alex de Green Monkey",
      genetica: "MK Ultra",
      banco: "THSeeds",
      bancoClave: "thseeds",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 1,
      premioRotulo: "1ro",
      ganador: "Bruno de Productos Mantra",
      clave: "bruno",
      genetica: "Ice Cream Cake x Sherb BX1",
      banco: "Seed Junky",
      bancoClave: "seed-junky",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Tío Guille",
      clave: "tio-guille",
      genetica: "Desfran",
      banco: "DF",
      bancoClave: "df",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 3,
      premioRotulo: "3ro",
      ganador: "Vasquito",
      clave: "vasquito",
      genetica: "Thai Choco x White OG",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 4,
      premioRotulo: "4to",
      ganador: "Emi Indico",
      genetica: "CFK",
      banco: "Organic Seed Co.",
      bancoClave: "organic-seed-co",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 5,
      premioRotulo: "5to",
      ganador: "Fabri",
      genetica: "Silver Token",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 1,
      premioRotulo: "1ro",
      ganador: "Ariel",
      genetica: "Sugar Black Rose",
      banco: "Doblejack Crew",
      bancoClave: "doblejack-crew",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Dani",
      genetica: "Papaya",
      banco: "Malakia Finest Genetics",
      bancoClave: "malakia",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin",
      puesto: 3,
      premioRotulo: "3ro",
      ganador: "Rodrigo",
      genetica: "Confidential OG",
      banco: "Malakia Finest Genetics",
      bancoClave: "malakia",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 1,
      premioRotulo: "1ro",
      ganador: "Juan de Buenos Aires Melts",
      genetica: "Jealousy F2 (Gelato 41 x Sherb BX1)",
      banco: "Seed Junky",
      bancoClave: "seed-junky",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Guille de Naesa",
      genetica: "GOS",
      banco: "Rkiem Seeds",
      bancoClave: "rkiem",
    },
    {
      categoria: "grow",
      categoriaRotulo: "Grow",
      puesto: 1,
      premioRotulo: "1ro",
      ganador: "Mati de Cañuto Cañete Bariloche",
      genetica: "L.A. Amnesia",
      nota: SIN_PLACA,
    },
    {
      categoria: "grow",
      categoriaRotulo: "Grow",
      puesto: 2,
      premioRotulo: "2do",
      ganador: "Julito de Castelar Grow Shop",
      clave: "julito",
      genetica: "African Cookies",
      banco: "Sweedlab",
      bancoClave: "sweedlab",
      nota: SIN_PLACA,
    },
    {
      categoria: "mencion-jurado",
      categoriaRotulo: "Mención del Jurado",
      premioRotulo: "Mención del Jurado",
      ganador: "Pirata de Alquimia Organic",
      clave: "pirata",
      genetica: "OG Solera",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención Equipo de Trabajo",
      premioRotulo: "Mención Equipo de Trabajo",
      ganador: "La Cueva del DF",
      tipo: "comercio",
      nota: "Premiaba al grow, dojo o crew donde aprendieron los participantes con mejor promedio.",
    },
  ]),

  // ── 2022 · Facebook, 20/07/2022 (cotejada con Instagram) ─────────────
  ...palmares(2022, "fb-2022-07-20", [
    {
      categoria: "campeon",
      categoriaRotulo: "Planta Campeona",
      premioRotulo: "Planta Campeona",
      ganador: "Maury Heavens Fruit",
      genetica: "Chizito Mandarino",
      banco: "Heavens Fruit",
      bancoClave: "heavens-fruit",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 1,
      premioRotulo: "1er puesto interior",
      ganador: "Julito",
      clave: "julito",
      genetica: "Runtz Buttons",
      banco: "Exotic Genetic",
      bancoClave: "exotic-genetic",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 2,
      premioRotulo: "2do puesto interior",
      ganador: "Rodri MDP Grower",
      genetica: "Gelato Sorbet",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 3,
      premioRotulo: "3er puesto interior",
      ganador: "Fede",
      genetica: "Spearmint Styles",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 4,
      premioRotulo: "4to puesto interior",
      ganador: "Augusto LeGrower2.0",
      genetica: "Sunset Sherbet x Gelato #33",
    },
    {
      categoria: "interior",
      categoriaRotulo: "Interior",
      puesto: 5,
      premioRotulo: "5to puesto interior",
      ganador: "Ornella Heavens Fruit",
      genetica: "Opera Thai Kush",
      banco: "Heavens Fruit Seeds",
      bancoClave: "heavens-fruit",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 1,
      premioRotulo: "1er puesto exterior",
      ganador: "Nico El Viejo",
      genetica: "From The Sur",
      banco: "Sweed Lab",
      bancoClave: "sweedlab",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 2,
      premioRotulo: "2do puesto exterior",
      ganador: "Tío Guille",
      clave: "tio-guille",
      genetica: "OG Solera",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 3,
      premioRotulo: "3er puesto exterior",
      ganador: "Nano Skunk",
      genetica: "Eli",
      banco: "Rkiem",
      bancoClave: "rkiem",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 4,
      premioRotulo: "4to puesto exterior",
      ganador: "Jhony JamRock",
      clave: "jhony",
      genetica: "Black Russian",
      banco: "Serious Seeds",
      bancoClave: null,
      nota: "Facebook dice Serious Seeds; Instagram, Delicious Seeds. Por eso no se cuenta entre los bancos.",
    },
    {
      categoria: "exterior",
      categoriaRotulo: "Exterior",
      puesto: 5,
      premioRotulo: "5to puesto exterior",
      ganador: "Fer Buenos Humos LP",
      genetica: "GlueBerry",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin Hash",
      puesto: 1,
      premioRotulo: "1er puesto Rosin Hash",
      ganador: "Manu SinSolvente",
      genetica: "Cake Crasher",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin Hash",
      puesto: 2,
      premioRotulo: "2do puesto Rosin Hash",
      ganador: "El Bruja",
      genetica: "Cumbia",
      banco: "Rkiem",
      bancoClave: "rkiem",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin Flor",
      puesto: 1,
      premioRotulo: "1ero puesto Rosin Flor",
      ganador: "Tincho Pulgar Verde",
      genetica: "L.A. Amnesia",
    },
    {
      categoria: "rosin",
      categoriaRotulo: "Rosin Flor",
      puesto: 2,
      premioRotulo: "2do puesto Rosin Flor",
      ganador: "Alejo",
      clave: "alejo",
      genetica: "Chem OG",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 1,
      premioRotulo: "1er puesto Hash",
      ganador: "Bruno Melts",
      clave: "bruno",
      genetica: "Wedding Sunset",
    },
    {
      categoria: "hash",
      categoriaRotulo: "Hash",
      puesto: 2,
      premioRotulo: "2do puesto Hash",
      ganador: "Tío Guille",
      clave: "tio-guille",
      genetica: "Chem OG",
    },
    {
      categoria: "mencion-jurado",
      categoriaRotulo: "Mención Jurado",
      premioRotulo: "Mención Jurado",
      ganador: "Mati Grower",
      clave: "mati-grower",
      genetica: "Mac&Diré",
      banco: "Sweed Lab",
      bancoClave: "sweedlab",
      nota: "«Mac&Diré», así en la publicación. Puede ser un error de tipeo por «Mac & Fire», la Mejor Planta de 2021, del mismo banco.",
    },
    {
      categoria: "grow",
      categoriaRotulo: "Mención Grow",
      puesto: 1,
      premioRotulo: "1ra mención Grow",
      ganador: "Quema2 Grow",
      tipo: "comercio",
    },
    {
      categoria: "grow",
      categoriaRotulo: "Mención Grow",
      puesto: 2,
      premioRotulo: "2da mención Grow",
      ganador: "Satélite TDC",
      tipo: "comercio",
      nota: "En el lugar de la genética, la publicación pone un nombre que en la versión con etiquetas es una cuenta de Instagram que puede ser de una persona; no se publica.",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención Crew",
      premioRotulo: "Mención Crew",
      ganador: "Buenos Aires Melts",
      tipo: "comercio",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención a la flor del pueblo",
      premioRotulo: "Mención a la flor del pueblo",
      ganador: "Ariel",
      genetica: "Squirt",
    },
    {
      categoria: "mencion-otra",
      categoriaRotulo: "Mención al Armador profesional",
      premioRotulo: "Mención al Armador profesional",
      ganador: "Tucho Bambulee",
    },
  ]),
];
