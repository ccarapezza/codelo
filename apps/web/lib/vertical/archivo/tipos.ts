// Tipos del archivo histórico: las notas propias del sitio anterior de la
// asociación (2014–2021), cargadas al CMS con su fecha original, y las notas
// nuevas que lo cuentan.
//
// El texto de cada nota vive en el CMS y se lee en /blog/<slug>. Acá va solo lo
// que necesitan el índice (/archivo), el bloque de la home y las redirecciones
// de las URL viejas, en un manifiesto que genera el repo de secretaría
// (notas.ts) a partir de lo que se preparó para importar.

/** Los tipos de nota, en el orden en que los ofrece el filtro del archivo. */
export const TIPOS_NOTA = [
  "entrevista",
  "cronica",
  "informe",
  "pronunciamiento",
  "cronologia",
  "investigacion",
] as const;

export type TipoNota = (typeof TIPOS_NOTA)[number];

/**
 * Cómo se imprime una portada: una lámina —la propia de la nota o la de su
 * tipo— es un grabado a dos tintas y va tal cual; una foto lleva el duotono de
 * la casa (`.cover-treatment`), así no rompe la serie.
 */
export type ClasePortada = "ilustracion" | "foto";

export type Portada = {
  /** `/archivo/portadas/<id>.webp` (versionada) o `/cms/uploads/…` (la del post en el CMS). */
  src: string;
  width: number;
  height: number;
  /** El texto alternativo de ESA imagen, el mismo que tiene en el CMS. */
  alt: string;
  clase: ClasePortada;
};

export type NotaArchivo = {
  /** El slug del post en el CMS: la nota se lee en /blog/<slug>. */
  slug: string;
  titulo: string;
  excerpt: string;
  /** La firma con que se publicó (en el CMS, `authorName`). */
  autor: string;
  /** Publicación, ISO en hora de Argentina (-03:00). En las viejas, la fecha original. */
  fecha: string;
  tipo: TipoNota;
  /** Id del artículo en el sitio anterior (`/cws/codeloweb/article/<id>`); `null` en las nuevas. */
  viejoId: number | null;
  /** Artículos viejos que quedaron dentro de esta nota: sus URL también llevan acá. */
  idsFusionados: number[];
  /**
   * En una entrevista, a quién se entrevistó, tal como lo nombran el título o
   * la bajada; `null` si no lo dicen (y en lo que no es entrevista).
   */
  entrevistado: string | null;
  portada: Portada;
  /** Va arriba en el archivo: las entrevistas y las notas nuevas. */
  destacada: boolean;
};
