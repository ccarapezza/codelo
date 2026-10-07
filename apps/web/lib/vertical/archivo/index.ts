// Punto de entrada del archivo histórico para páginas y componentes.

import { NOTAS as GENERADAS } from "./notas";
import { cronologico, slugsViejos } from "./stats";

export * from "./tipos";
export * from "./stats";
export {
  ILUSTRACIONES,
  ILUSTRACION_DE_TIPO,
  type IlustracionArchivo,
  type IlustracionId,
} from "./ilustraciones";

/** Todas las notas del archivo, de la más vieja a la más nueva. */
export const NOTAS = cronologico(GENERADAS);

/** Los slugs de las notas del sitio anterior: la home no las muestra entre las últimas. */
export const SLUGS_VIEJOS: ReadonlySet<string> = slugsViejos(NOTAS);
