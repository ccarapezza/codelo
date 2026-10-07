// Tipos del dominio de la Copa Cata del Oeste (2014–2022).
//
// La sección cuenta historia, no agenda: todo lo que imprime sale de estos
// datos tipados y cada dato lleva su fuente. Un hueco es `null` con nota, nunca
// una cadena vacía ni un cero que quiera decir "no sé".

export type Anio = 2014 | 2015 | 2016 | 2017 | 2018 | 2019 | 2021 | 2022;

/** Número de la edición tal como lo usó su pieza principal. */
export type Rotulo = "1ª" | "2ª" | "3ª" | "IV" | "V" | "VI" | "VII" | "8ª";

/**
 * Quién organizaba, según la fecha de la edición:
 * - `grupo`: 2014–2015, el grupo Cogollos del Oeste, antes de constituirse.
 * - `constituida-sin-personeria`: 2016–2017, la asociación constituida el
 *   04/05/2016 y a la espera de la personería (Res. IGJ 1435 del 11/08/2017,
 *   un mes después de la IV Copa).
 * - `asociacion`: 2018 en adelante, la asociación civil.
 */
export type Etapa = "grupo" | "constituida-sin-personeria" | "asociacion";

export type TipoFuente =
  /** Nota del sitio anterior de la asociación, leída en web.archive.org. */
  | "web-vieja"
  /** Publicación de la página de Facebook de la asociación. */
  | "facebook"
  /** Publicación, historia o reel de la cuenta de Instagram de la asociación. */
  | "instagram"
  /** Afiche, flyer, placa, credencial o entrada. */
  | "pieza"
  /** Documento interno: bases, protocolos, planillas. */
  | "archivo"
  /** Correo de la asociación. */
  | "correo";

export type Fuente = {
  id: string;
  tipo: TipoFuente;
  titulo: string;
  /** Fecha de la publicación o del documento (ISO), en hora de Argentina. */
  fecha: string | null;
  /**
   * Solo URLs públicas: Facebook o Instagram de la asociación y capturas de
   * web.archive.org. Lo interno (archivo, correo) va con `null` y se describe
   * en el título, sin identificadores ni nombres de archivo.
   */
  url: string | null;
  nota?: string;
};

/** Dos o más fuentes que dicen cosas distintas. Se muestran todas, sin elegir. */
export type Contradiccion = {
  tema: string;
  versiones: Array<{ valor: string; fuente: string }>;
  nota?: string;
};

/**
 * Un dato con su fuente. (No se llama `Dato`: choca con el componente.)
 *
 * - `valor` y `fuente` en `null`: ninguna fuente lo dice.
 * - `valor` en `null` con `fuente`: la fuente lo trata pero el dato no se
 *   publica o está en disputa; la `nota` explica cuál de las dos.
 */
export type Campo<T> = { valor: T | null; fuente: string | null; nota?: string };

export type Categoria =
  | "campeon"
  | "interior"
  | "exterior"
  | "flores-otra"
  | "rosin"
  | "hash"
  | "extracciones"
  | "grow"
  | "mencion-jurado"
  | "mencion-mesa"
  | "mencion-hash"
  | "mencion-otra";

export type Familia = "flor" | "extracto" | "otro";

/** Orden canónico: el de los filtros, las leyendas y la matriz. */
export const CATEGORIAS: readonly Categoria[] = [
  "campeon",
  "interior",
  "exterior",
  "flores-otra",
  "rosin",
  "hash",
  "extracciones",
  "mencion-hash",
  "grow",
  "mencion-jurado",
  "mencion-mesa",
  "mencion-otra",
];

export const FAMILIAS: readonly Familia[] = ["flor", "extracto", "otro"];

export const FAMILIA_DE: Record<Categoria, Familia> = {
  campeon: "flor",
  interior: "flor",
  exterior: "flor",
  "flores-otra": "flor",
  rosin: "extracto",
  hash: "extracto",
  extracciones: "extracto",
  "mencion-hash": "extracto",
  grow: "otro",
  "mencion-jurado": "otro",
  "mencion-mesa": "otro",
  "mencion-otra": "otro",
};

/** Nombre de cada categoría normalizada, para filtros y leyendas. */
export const CATEGORIA_ROTULO: Record<Categoria, string> = {
  campeon: "Campeón",
  interior: "Interior",
  exterior: "Exterior",
  "flores-otra": "Podio general",
  rosin: "Rosin",
  hash: "Hash",
  extracciones: "Extracciones",
  "mencion-hash": "Mención de hash",
  grow: "Grow",
  "mencion-jurado": "Mención del jurado",
  "mencion-mesa": "Mención de mesa",
  "mencion-otra": "Otras menciones",
};

export const FAMILIA_ROTULO: Record<Familia, string> = {
  flor: "Flores",
  extracto: "Extractos",
  otro: "Menciones y otros premios",
};

export type Premio = {
  /** `AAAA-NN`, en el orden de la fuente con el campeón primero. */
  id: string;
  edicion: Anio;
  categoria: Categoria;
  /** La categoría con el nombre que le dio la fuente. */
  categoriaRotulo: string;
  puesto: number | null;
  /** El rótulo literal del premio en la fuente ("1er puesto interior", "Campeona"). */
  premioRotulo: string;
  /**
   * El nombre con el que compitió, según la política de nombres de premios.ts:
   * apodo o nombre de pila, con su grow, su banco o su marca si los usaba;
   * nunca apellidos ni cuentas personales.
   */
  ganador: string;
  /** "comercio": quien ganó es un comercio, un grow, un banco o una marca. */
  ganadorTipo: "persona" | "colectivo" | "comercio";
  /**
   * Identidad entre filas, solo cuando es razonable y está anotada en
   * `CLAVES_GANADOR`. `null` = no se afirma que sea la misma persona que
   * ninguna otra fila, aunque el nombre coincida.
   */
  ganadorClave: string | null;
  genetica: string | null;
  /** Agrupa grafías de una misma genética ("Desfrán" / "Desfran"). `null` = no se cuenta. */
  geneticaClave: string | null;
  /** El banco de la genética premiada: es dato del palmarés y sí se publica. */
  banco: string | null;
  /** Agrupa grafías de un mismo banco. `null` = no se cuenta (dato en disputa). */
  bancoClave: string | null;
  /** Número de muestra como lo publicó la fuente ("17", "M45"). */
  muestra: string | null;
  fuente: string;
  nota?: string;
};

export type Jurado = {
  flores: string[];
  extracciones: string[];
  fuente: string;
  nota?: string;
};

export type Cronica = {
  /** La firma publicada. */
  autor: string;
  fecha: string;
  wayback: string;
  fuente: string;
  /** En palabras propias: lo que cuenta, sin celebrar ni invitar. */
  resumen: string;
  /** Una frase textual y neutral de la crónica. */
  cita: string;
};

export type Edicion = {
  anio: Anio;
  numero: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  rotulo: Rotulo;
  /** Otras formas con que se nombró el número ("6ta", "8va"). */
  rotuloAlt: string[];
  nombre: string;
  etapa: Etapa;
  /** ISO aaaa-mm-dd. */
  fecha: string;
  /** Lo verifica `datos.test.ts` contra la fecha. */
  diaSemana: "sábado" | "domingo";
  fechaFuentes: string[];
  fechaNota?: string;
  horaInicio: Campo<string>;
  /** Solo la zona ("Flores, CABA", "CABA"): nunca el nombre del lugar ni la dirección. */
  lugar: Campo<string>;
  /** Cómo fue, en viñetas: lo que pasó, contado sin celebrar ni invitar. */
  formato: Array<{ texto: string; fuente: string }>;
  categoriasTexto: Campo<string>;
  muestras: Campo<number>;
  participantes: Campo<number>;
  cupo: Campo<number>;
  mesas: Campo<number>;
  /** Precio de la entrada, solo como dato histórico. */
  entrada: Campo<string>;
  /**
   * Marcas que acompañaron: el texto da solo la cantidad (sus logos se ven en
   * las piezas de la época). Si las fuentes difieren, rango.
   */
  marcas: { min: number; max: number; fuentes: string[]; nota?: string };
  /** Con el nombre con que figuraron, nunca el apellido. `null` = no se conocen los nombres. */
  jurado: Jurado | null;
  /** De dónde sale el palmarés. Sin fuentes = no hay registro de ganadores. */
  palmares: { fuentes: string[]; nota?: string };
  /** Solo cuando hay una crónica publicada. */
  cronica: Cronica | null;
  /** Id de `GRAFICAS`. */
  heroGrafica: string | null;
  /** Todas las fuentes de la edición, también las que no cita ningún campo. */
  fuentes: string[];
  contradicciones: Contradiccion[];
  faltantes: string[];
};

/**
 * Los tipos de pieza gráfica. Cada uno tiene su rótulo en
 * messages/es.vertical.json → copa.graficas; lo prueba datos.test.ts, porque
 * una clave que falta recién rompe al renderizar.
 */
export const TIPOS_GRAFICA = [
  "afiche",
  "flyer",
  "logo",
  "placa-ganadores",
  "placa-sponsors",
  "entrada",
  "credencial",
  "rotulo",
  "sticker",
  "ficha-cata",
  "etiqueta-premio",
] as const;

export type TipoGrafica = (typeof TIPOS_GRAFICA)[number];

/**
 * Cómo se dibuja un objeto de la época, según de qué estaba hecho:
 * - `plastico`: plastificado, con el brillo que corre con la inclinación, el
 *   borde del laminado y la ranura del cordón; cuelga.
 * - `vinilo`: sticker con brillo leve y el borde blanco del corte.
 * - `adhesivo`: rótulo de papel autoadhesivo, apenas satinado.
 * - `papel`: mate, sin reflejo; solo la luz que lo recorre.
 */
export type Material = "plastico" | "vinilo" | "adhesivo" | "papel";

/**
 * Las piezas que pasaron de mano en mano, con su material. Las demás —afiches,
 * flyers, logos y placas— son gráficas planas y van en su riel.
 */
export const MATERIAL_OBJETO = {
  credencial: "plastico",
  entrada: "papel",
  sticker: "vinilo",
  rotulo: "adhesivo",
  "ficha-cata": "papel",
  "etiqueta-premio": "papel",
} as const satisfies Partial<Record<TipoGrafica, Material>>;

export type TipoObjeto = keyof typeof MATERIAL_OBJETO;

/** De dónde sale un video. El rótulo de cada uno, en copa.videos (mismo test). */
export const ORIGENES_VIDEO = ["reel", "historia", "facebook"] as const;

export type OrigenVideo = (typeof ORIGENES_VIDEO)[number];

export type Grafica = {
  id: string;
  edicion: Anio;
  tipo: TipoGrafica;
  src: `/copa-cata/${string}.webp`;
  width: number;
  height: number;
  alt: string;
  /**
   * Lo que distingue a la pieza de otras del mismo tipo, con las palabras que
   * imprime ("Socio participante", "Mejor Planta"). Va después del tipo en el
   * rótulo que la acompaña.
   */
  detalle?: string;
  /**
   * El material de un objeto cuando no es el de su tipo (`MATERIAL_OBJETO`):
   * la credencial de 2022 era una tarjeta de papel para escanear, no un
   * plastificado que cuelga.
   */
  material?: Material;
  /** Id de `FUENTES`. */
  fuente: string;
};

/** `fuente` es un id de `FUENTES` en los dos casos. */
export type Medio =
  | {
      id: string;
      tipo: "foto";
      edicion: Anio;
      url: `/cms/uploads/${string}`;
      width: number;
      height: number;
      formats: { thumbnail?: string; small?: string; medium?: string; large?: string };
      alt: string;
      fuente: string;
      licencia: "propia" | "fotografo-cedida" | "redes-asociacion";
      tags: string[];
    }
  | {
      id: string;
      tipo: "video";
      edicion: Anio;
      url: `/cms/uploads/${string}.mp4`;
      poster: `/cms/uploads/${string}`;
      width: number;
      height: number;
      duracion: number;
      alt: string;
      fuente: string;
      licencia: "redes-asociacion";
      origen: OrigenVideo;
    };
