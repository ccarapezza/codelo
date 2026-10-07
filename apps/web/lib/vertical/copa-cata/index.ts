// Punto de entrada de la Copa Cata del Oeste para páginas y componentes.

import { EDICIONES } from "./ediciones";
import { GRAFICAS } from "./graficas";
import { MEDIOS } from "./medios";
import { PREMIOS } from "./premios";
import { repartirPiezas } from "./stats";
import type { Anio, Edicion, Grafica, Medio, Premio, TipoObjeto } from "./tipos";

export * from "./tipos";
export * from "./stats";
export * from "./formato";
export { EDICIONES } from "./ediciones";
export { PREMIOS, CLAVES_GANADOR } from "./premios";
export { FUENTES, fuente } from "./fuentes";
export { GRAFICAS } from "./graficas";
export { MEDIOS } from "./medios";
export { ILUSTRACION_EDICION, ILUSTRACION_PORTADA, ORNAMENTOS, type Ilustracion } from "./ilustraciones";

/** Los años con edición, en orden. */
export const ANIOS: readonly Anio[] = [2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022];

/** Los años con palmarés, en orden: los que el filtro del palmarés ofrece. */
export const ANIOS_CON_PREMIOS: readonly Anio[] = ANIOS.filter((a) => PREMIOS.some((p) => p.edicion === a));

export function esAnio(valor: unknown): valor is Anio {
  return typeof valor === "number" && (ANIOS as readonly number[]).includes(valor);
}

/**
 * El año de un segmento de ruta, o `null`. Solo acepta cuatro dígitos: "2019.0"
 * o " 2019" no son la misma página que "2019".
 */
export function anioDeParam(param: string): Anio | null {
  if (!/^\d{4}$/.test(param)) return null;
  const anio = Number(param);
  return esAnio(anio) ? anio : null;
}

export function getEdicion(anio: Anio): Edicion {
  const edicion = EDICIONES.find((e) => e.anio === anio);
  if (!edicion) throw new Error(`Copa Cata: no hay ficha de ${anio}`);
  return edicion;
}

export function anterior(anio: Anio): Anio | null {
  const i = ANIOS.indexOf(anio);
  return i > 0 ? ANIOS[i - 1] : null;
}

export function siguiente(anio: Anio): Anio | null {
  const i = ANIOS.indexOf(anio);
  return i >= 0 && i < ANIOS.length - 1 ? ANIOS[i + 1] : null;
}

/** El palmarés de una edición, en el orden de la fuente. */
export function premiosDe(anio: Anio): Premio[] {
  return PREMIOS.filter((p) => p.edicion === anio);
}

/** Las gráficas planas de una edición: afiches, flyers, logos y placas. */
export function graficasDe(anio: Anio): Grafica[] {
  return repartirPiezas(GRAFICAS.filter((g) => g.edicion === anio)).planas;
}

/** Los objetos de una edición que pasaron de mano en mano: credenciales, entradas, rótulos… */
export function objetosDe(anio: Anio): Array<Grafica & { tipo: TipoObjeto }> {
  return repartirPiezas(GRAFICAS.filter((g) => g.edicion === anio)).objetos;
}

export function mediosDe(anio: Anio): Medio[] {
  return MEDIOS.filter((m) => m.edicion === anio);
}
