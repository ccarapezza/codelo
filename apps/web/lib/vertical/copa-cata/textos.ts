// Texto corrido de la Copa Cata del Oeste: todo lo que la sección dice con
// palabras propias, en un solo lugar para revisarlo y editarlo.
//
// Tono (pedido de la Secretaría, 06/10/2026): descontracturado y rioplatense,
// con aire de noche y de cosecha —la ronda, la tribu, el cielo, las órbitas—
// sin ponerse cursi. La Copa se cuenta como lo que fue: una celebración de la
// comunidad y del cultivo. Se presenta como información, no como duda: sin
// advertencias, sin notas de método y sin hablar de lo que no pasó. Nada invita
// a consumir ni convoca: es historia.
//
// Ganadores y jurado, con el nombre con el que compitieron; de las marcas, solo
// cuántas acompañaron. Las cifras no se escriben a mano: llegan por parámetro y
// salen de ediciones.ts, premios.ts o stats.ts. Las etiquetas cortas de la
// interfaz (botones, rótulos) viven en messages/es.vertical.json → "copa".

import { formatFecha, formatFechaCorta } from "./formato";
import type { Anio, Edicion, Premio } from "./tipos";

// ── Piezas ──────────────────────────────────────────────────────────────

/** Rango de años con raya: "2014–2022". */
const rango = (desde: number, hasta: number) => (desde === hasta ? String(desde) : `${desde}–${hasta}`);

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const minuscular = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

const LETRAS = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
];

/**
 * Un número chico en letras ("ocho", "diez"); de 21 en adelante, en cifras.
 * `femenino` cambia solo el uno: "una edición", "un jurado".
 */
export function enLetras(n: number, femenino = true): string {
  if (!Number.isInteger(n) || n < 0 || n >= LETRAS.length) return String(n);
  if (n === 1) return femenino ? "una" : "uno";
  return LETRAS[n];
}

const ORDINALES: Record<Edicion["numero"], string> = {
  1: "primera",
  2: "segunda",
  3: "tercera",
  4: "cuarta",
  5: "quinta",
  6: "sexta",
  7: "séptima",
  8: "octava",
};

/** "la sexta": el número de la edición, en palabras. */
export const ordinal = (e: Pick<Edicion, "numero">) => ORDINALES[e.numero];

/** "2015, 2016 y 2021". */
export function enumerar(items: ReadonlyArray<string | number>): string {
  const t = items.map(String);
  return t.length <= 1 ? (t[0] ?? "") : `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}`;
}

const premiosTxt = (n: number) => `${n} ${n === 1 ? "premio" : "premios"}`;

// ── Portada ─────────────────────────────────────────────────────────────

/** "Ocho cosechas · 2014–2022". */
export function cejaPortada(ediciones: number, desde: number, hasta: number): string {
  return `${capitalizar(enLetras(ediciones))} cosechas · ${rango(desde, hasta)}`;
}

export function bajadaPortada(ediciones: number): string {
  return `Durante ${enLetras(ediciones)} ediciones, el oeste se juntó a celebrar la cosecha: cultivadores, mesas largas, frascos que pasaban de mano en mano y una copa que cada año encontraba nuevo dueño. Esta es la historia de esa ronda.`;
}

/** El manifiesto: de qué se trató la Copa, en dos párrafos. */
export function manifiesto(primera: Pick<Edicion, "anio">): [string, string] {
  return [
    `La Copa nació en ${primera.anio} como una cata entre socios y creció hasta convertirse en el gran encuentro de cultivo del oeste: un día para mostrar lo que cada uno hizo crecer, aprender de lo que hicieron los demás y volver a casa con ideas, semillas y amigos nuevos.`,
    "Fue competencia, sí, pero sobre todo fue tribu: asociativismo, cooperación y saberes compartidos alrededor de la planta.",
  ];
}

/** Título y descripción de la portada para buscadores y redes. */
export function seoPortada(ediciones: number, desde: number, hasta: number) {
  return {
    title: `Copa Cata del Oeste: ${enLetras(ediciones)} cosechas, ${rango(desde, hasta)}`,
    description: `${capitalizar(enLetras(ediciones))} ediciones en las que el oeste se juntó a celebrar la cosecha: cultivadores, mesas largas, frascos de mano en mano y una copa que cada año encontraba nuevo dueño.`,
  };
}

/** "En números": la última cifra va con su "hasta" arriba. */
export const NUMEROS = {
  copas: "Copas",
  premios: "Premios",
  geneticas: "Genéticas premiadas",
  ganadores: "Ganadores",
  marcasAntes: "Hasta",
  marcas: "marcas por edición",
};

// ── Récords ─────────────────────────────────────────────────────────────

/** "5 premios en 4 copas". */
export function premiosEnCopas(premios: number, copas: number): string {
  return `${premiosTxt(premios)} en ${copas} ${copas === 1 ? "copa" : "copas"}`;
}

/** "4 premios, en 2015, 2016, 2017 y 2021". */
export function premiosEnAnios(premios: number, anios: readonly number[]): string {
  return `${premiosTxt(premios)}, en ${enumerar(anios)}`;
}

export const RECORDS = {
  ganador: "Quien más premios ganó",
  genetica: "La genética más premiada",
  banco: "El banco con más premios",
  /** El enlace de cada récord al palmarés filtrado. */
  premiosDe: (nombre: string) => `Los premios de ${nombre}`,
};

/** La invitación al palmarés desde la portada. */
export function palmaresCta(premios: number): string {
  return `${premiosTxt(premios)}, de punta a punta: quién ganó, con qué genética y de qué banco.`;
}

// ── Riel de ediciones ───────────────────────────────────────────────────

/** La línea de la primera edición en el riel, que no tiene campeón para mostrar. */
export const PRIMERA_RONDA = "La primera ronda, entre socios";

// ── Edición ─────────────────────────────────────────────────────────────

/** Ceja del encabezado: "VI Copa Cata del Oeste · domingo 14/07/2019". */
export function cejaEdicion(e: Pick<Edicion, "nombre" | "fecha">): string {
  return `${e.nombre} · ${formatFecha(e.fecha)}`;
}

export type DatosBajada = {
  edicion: Edicion;
  /** El premio mayor, o `null` si la edición no tiene palmarés. */
  campeon: Premio | null;
  /** Todo el palmarés de la edición. */
  premios: readonly Premio[];
};

/** "Beto se llevó la copa con una Black Jack x White Satin x Herijuana". */
const conUna = (c: Premio) => (c.genetica ? ` con una ${c.genetica}` : "");

/** El texto de cada edición: qué la hizo distinta, con las cifras de los datos. */
const BAJADAS: Record<Anio, (d: DatosBajada) => string> = {
  2014: ({ edicion: e }) => {
    const zona = e.lugar.valor ? ` en ${e.lugar.valor.split(",")[0]}` : "";
    return `La ${ordinal(e)} fue íntima: una tarde de ${e.diaSemana}${zona}, entre socios del grupo, con mesas compartidas y muestras que iban y venían. Ahí empezó todo.`;
  },
  2015: ({ edicion: e, campeon: c }) =>
    `La ${ordinal(e)} ya tuvo campeón, segundo puesto, premio del jurado y menciones de mesa.` +
    (c ? ` ${c.ganador} se llevó la copa${conUna(c)}, y la ronda empezó a crecer.` : ""),
  2016: ({ edicion: e, campeon: c }) =>
    "Copa dorada, hojas ilustradas en rojo y amarillo y cupos agotados antes de la fecha." +
    (c
      ? ` ${c.ganador} levantó la ${ordinal(e)}${conUna(c)}, y por primera vez Interior y Exterior se premiaron por separado.`
      : " Por primera vez, Interior y Exterior se premiaron por separado."),
  2017: ({ edicion: e, campeon: c }) =>
    `La ${ordinal(e)} llegó con afiche de boceto, plumas mecánicas y engranajes.` +
    (c
      ? ` ${c.ganador} se quedó con la copa${c.genetica ? ` gracias a una ${c.genetica} de exterior` : ""}, y además del podio se premiaron las extracciones y la mejor presentación.`
      : " Además del podio, se premiaron las extracciones y la mejor presentación."),
  2018: ({ edicion: e, campeon: c }) =>
    `La ${ordinal(e)} se mudó al ${e.diaSemana} y fue la primera de la asociación civil.` +
    (c ? ` ${c.ganador} ganó${conUna(c)}, y hubo premios en Interior, Exterior y extracciones.` : ""),
  2019: ({ edicion: e, campeon: c }) => {
    const cifras = [
      e.muestras.valor ? `${e.muestras.valor} muestras` : null,
      e.mesas.valor ? `${enLetras(e.mesas.valor)} mesas` : null,
      `${e.marcas.max} marcas acompañando`,
    ].filter(Boolean);
    return (
      `La ${ordinal(e)} fue a lo grande: ${cifras.join(", ")} y un jurado catando en paralelo.` +
      (c ? ` ${c.ganador} se coronó${conUna(c)}, y Rosin y Hash tuvieron su propio podio.` : "")
    );
  },
  2021: ({ edicion: e, campeon: c }) => {
    const jurado = e.jurado ? e.jurado.flores.length + e.jurado.extracciones.length : null;
    return (
      `La ${ordinal(e)} llegó en noviembre, al aire libre y bajo carpa. Sumó la categoría Grow` +
      (jurado ? ` y un jurado de ${enLetras(jurado, false)}` : "") +
      (c ? `, y la ${c.premioRotulo} fue para el ${c.ganador}${conUna(c)}.` : ".")
    );
  },
  2022: ({ edicion: e, campeon: c, premios }) =>
    `La ${ordinal(e)} fue cósmica: flyer de galaxia, preselección de muestras, ${premiosTxt(premios.length)} y una convocatoria que invitó especialmente a mujeres y disidencias.` +
    (c ? ` ${c.ganador} se llevó la ${c.premioRotulo}${conUna(c)}.` : ""),
};

export function bajadaEdicion(d: DatosBajada): string {
  return BAJADAS[d.edicion.anio](d);
}

/** Una frase corta por edición, para el título en buscadores. */
const LEMAS: Record<Anio, string> = {
  2014: "la primera ronda",
  2015: "la ronda empieza a crecer",
  2016: "copa dorada",
  2017: "plumas y engranajes",
  2018: "la primera de la asociación civil",
  2019: "a lo grande",
  2021: "bajo carpa",
  2022: "la octava, cósmica",
};

export function seoEdicion(d: DatosBajada) {
  return {
    title: `${d.edicion.nombre} (${d.edicion.anio}): ${LEMAS[d.edicion.anio]}`,
    description: bajadaEdicion(d),
  };
}

/**
 * Los datos de la edición como chips. Solo lo que se conoce: un campo sin
 * valor no aparece. De las marcas va el total de todas las fuentes juntas:
 * cada una lista una parte (el afiche, el agradecimiento, la planilla), así
 * que el máximo es la cuenta de todas las que acompañaron.
 */
export function chipsEdicion(e: Edicion): Array<{ clave: string; texto: string }> {
  const chips: Array<{ clave: string; texto: string | null }> = [
    {
      clave: "hora",
      texto: `${capitalizar(e.diaSemana)}${e.horaInicio.valor ? `, desde las ${e.horaInicio.valor}` : ""}`,
    },
    { clave: "zona", texto: e.lugar.valor },
    { clave: "muestras", texto: e.muestras.valor ? `${e.muestras.valor} muestras` : null },
    { clave: "mesas", texto: e.mesas.valor ? `${e.mesas.valor} mesas` : null },
    { clave: "cupo", texto: e.cupo.valor ? `Cupo de ${e.cupo.valor} personas` : null },
    { clave: "entrada", texto: e.entrada.valor ? `Entrada: ${minuscular(e.entrada.valor)}` : null },
    { clave: "marcas", texto: `${e.marcas.max} marcas acompañaron` },
  ];
  return chips.flatMap((c) => (c.texto ? [{ clave: c.clave, texto: c.texto }] : []));
}

/** La firma de una crónica: "Gato, en el sitio de la asociación · 05/08/2014". */
export function firmaCronica(autor: string, fecha: string): string {
  return `${autor}, en el sitio de la asociación · ${formatFechaCorta(fecha)}`;
}

// ── Palmarés ────────────────────────────────────────────────────────────

export function cejaPalmares(desde: number, hasta: number): string {
  return `Palmarés · ${rango(desde, hasta)}`;
}

export const BAJADA_PALMARES =
  "Todos los premios de la Copa, de punta a punta: quién ganó, con qué genética y de qué banco. Filtrá por edición o por categoría, o buscá un nombre.";

/** Lo que dice la tabla cuando el filtro no trae nada. */
export const SIN_RESULTADOS = "Nada coincide con ese filtro. Probá con menos palabras o con otra categoría.";

/** "N premios · M ediciones". */
export function conteoPremios(premios: number, ediciones: number): string {
  return `${premiosTxt(premios)} · ${ediciones} ${ediciones === 1 ? "edición" : "ediciones"}`;
}

/** "Ver todos los premios de 2019". */
export const verPremiosDe = (anio: Anio) => `Ver los premios de ${anio} en el palmarés`;

// ── Figuras del palmarés ────────────────────────────────────────────────

export const FIGURAS = {
  porCategoria: {
    titulo: "Premios por categoría",
    bajada: "Flores, extractos y menciones: cuántos premios dio cada categoría en todas las copas.",
  },
  geneticas: {
    titulo: "Genéticas que repitieron premio",
    bajada: "Las que volvieron a subir al podio, edición tras edición.",
  },
  recurrentes: {
    titulo: "Quiénes repitieron premio",
    bajada: "Los nombres que volvieron a ganar, con las copas en las que lo hicieron.",
  },
  matriz: {
    titulo: "Qué se premió cada año",
    bajada: "Cada punto, una categoría con premio esa edición; el punto chico, una que ese año no estuvo.",
    sinPremio: "No estuvo ese año",
  },
};
