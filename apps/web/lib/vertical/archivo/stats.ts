// Funciones puras del archivo histórico: fechas, agrupaciones, el filtro de la
// URL, la selección de la home y adónde lleva una URL del sitio anterior.

import { TIPOS_NOTA, type NotaArchivo, type TipoNota } from "./tipos";

// Las fechas del manifiesto vienen todas en hora de Argentina y con el mismo
// formato (lo garantiza el generador y lo vigila datos.test.ts): el día se lee
// tal como está escrito, sin pasar por Date. Así el 05/08/2014 a las 02:32 no
// se vuelve 04/08 en una máquina con otra zona horaria.
const FECHA = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}-03:00$/;

function partes(iso: string): { anio: number; mes: string; dia: string } {
  const m = FECHA.exec(iso);
  if (!m) throw new RangeError(`Fecha inválida (se espera aaaa-mm-ddThh:mm:ss-03:00): "${iso}"`);
  return { anio: Number(m[1]), mes: m[2], dia: m[3] };
}

/** "2014-08-05T02:32:33-03:00" → "05/08/2014". */
export function fechaCorta(iso: string): string {
  const p = partes(iso);
  return `${p.dia}/${p.mes}/${p.anio}`;
}

/** "2014-08-05T02:32:33-03:00" → 2014. */
export function anioDe(iso: string): number {
  return partes(iso).anio;
}

/**
 * De la más vieja a la más nueva; a igual fecha, por slug. Con todas las fechas
 * en el mismo huso y formato, el orden de las cadenas es el del tiempo.
 */
export function cronologico(notas: readonly NotaArchivo[]): NotaArchivo[] {
  return [...notas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.slug.localeCompare(b.slug));
}

/** Las notas agrupadas por año: los años en orden y, dentro de cada uno, en orden cronológico. */
export function porAnio(
  notas: readonly NotaArchivo[],
): Array<{ anio: number; notas: NotaArchivo[] }> {
  const grupos = new Map<number, NotaArchivo[]>();
  for (const n of cronologico(notas)) {
    const anio = anioDe(n.fecha);
    grupos.set(anio, [...(grupos.get(anio) ?? []), n]);
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([anio, lista]) => ({ anio, notas: lista }));
}

/** Cuántas notas hay de cada tipo, en el orden del filtro. Los tipos sin notas no aparecen. */
export function conteoPorTipo(
  notas: readonly NotaArchivo[],
): Array<{ tipo: TipoNota; cantidad: number }> {
  return TIPOS_NOTA.map(tipo => ({
    tipo,
    cantidad: notas.filter(n => n.tipo === tipo).length,
  })).filter(c => c.cantidad > 0);
}

/**
 * El tipo que pide la URL (`?tipo=`), si es uno de los que tienen notas. Cualquier
 * otra cosa —vacío, repetido, inventado— vale `null`: se muestra todo.
 */
export function tipoDeParam(
  valor: string | string[] | undefined,
  disponibles: readonly TipoNota[],
): TipoNota | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return disponibles.find(t => t === v) ?? null;
}

/** Los años que cubren las notas del sitio anterior (las nuevas no cuentan), o `null` si no hay. */
export function rangoViejo(notas: readonly NotaArchivo[]): { desde: number; hasta: number } | null {
  const anios = notas.filter(n => n.viejoId !== null).map(n => anioDe(n.fecha));
  if (anios.length === 0) return null;
  return { desde: Math.min(...anios), hasta: Math.max(...anios) };
}

/**
 * Las entrevistas del bloque de la home: una por entrevistador —la más reciente
 * de cada uno—, así se ven voces y años distintos. Si no hay tantos
 * entrevistadores, se completa con las más recientes que queden. De la más
 * nueva a la más vieja.
 */
export function entrevistasParaHome(notas: readonly NotaArchivo[], cuantas = 3): NotaArchivo[] {
  const candidatas = cronologico(notas)
    .reverse()
    .filter(n => n.tipo === "entrevista" && n.destacada);
  const elegidas: NotaArchivo[] = [];
  const autores = new Set<string>();
  for (const n of candidatas) {
    if (elegidas.length === cuantas) break;
    if (autores.has(n.autor)) continue;
    autores.add(n.autor);
    elegidas.push(n);
  }
  for (const n of candidatas) {
    if (elegidas.length === cuantas) break;
    if (!elegidas.includes(n)) elegidas.push(n);
  }
  return cronologico(elegidas).reverse();
}

/**
 * El entrevistado con su preposición, para leer la frase entera: «a Franco»,
 * «al Dr. Álvaro Sauri», «a la Dra. …». Lo usa el texto para lectores de
 * pantalla, que no ven la flecha entre entrevistador y entrevistado.
 */
export function conPreposicion(nombre: string): string {
  if (/^Dra\.?\s/.test(nombre)) return `a la ${nombre}`;
  if (/^Dr\.?\s/.test(nombre)) return `al ${nombre}`;
  return `a ${nombre}`;
}

/**
 * Los tipos de una lista, como frase: «Crónicas, informes y pronunciamientos».
 * `nombre` da el rótulo en plural de cada tipo.
 */
export function listaDeTipos(tipos: readonly TipoNota[], nombre: (t: TipoNota) => string): string {
  const frase = new Intl.ListFormat("es", { type: "conjunction" }).format(
    tipos.map(t => nombre(t).toLocaleLowerCase("es")),
  );
  return frase.charAt(0).toLocaleUpperCase("es") + frase.slice(1);
}

/** Los slugs de las notas del sitio anterior. Las nuevas no están: esas sí pueden ir a la portada. */
export function slugsViejos(notas: readonly NotaArchivo[]): Set<string> {
  return new Set(notas.filter(n => n.viejoId !== null).map(n => n.slug));
}

/**
 * Una lista de notas del CMS sin las del sitio anterior. La home la usa para
 * que una nota de 2015 no aparezca entre las últimas ni en el carrusel, ni
 * siquiera mientras se importa (al publicar, Strapi le pone la hora del momento
 * y la fecha original se escribe después).
 */
export function sinNotasViejas<T extends { slug: string }>(
  posts: readonly T[],
  viejos: ReadonlySet<string>,
): T[] {
  return posts.filter(p => !viejos.has(p.slug));
}

/**
 * Adónde lleva una URL del sitio anterior, a partir de lo que va después de
 * `/cws/`. Los artículos se publicaban en `/cws/codeloweb/article/<id>`: si el
 * id es el de una nota del archivo, o el de una que quedó fusionada en otra, a
 * esa nota; cualquier otra dirección del sitio viejo, al archivo.
 */
export function destinoUrlVieja(ruta: readonly string[], notas: readonly NotaArchivo[]): string {
  const [sitio, seccion, id] = ruta;
  if (sitio === "codeloweb" && seccion === "article" && id !== undefined && /^\d{1,9}$/.test(id)) {
    const n = Number(id);
    const nota = notas.find(x => x.viejoId === n || x.idsFusionados.includes(n));
    if (nota) return `/blog/${nota.slug}`;
  }
  return "/archivo";
}
