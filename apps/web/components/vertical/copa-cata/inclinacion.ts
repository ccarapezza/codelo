// Cuánto se inclina un objeto de la Copa según dónde está el puntero.
//
// Pura: recibe el punto y el rectángulo del objeto sin transformar y devuelve
// lo que Objetos.tsx escribe como variables CSS. El objeto se hunde del lado
// del puntero, como una tarjeta que se aprieta con la yema del dedo, y la luz
// del material corre hacia donde está el puntero.

/** Grados máximos: sobre el eje horizontal (arriba/abajo) y el vertical (costados). */
export const INCLINACION_MAXIMA = { x: 9, y: 13 } as const;

export type Inclinacion = {
  /** rotateX, en grados: positivo hunde el borde de arriba. */
  rx: number;
  /** rotateY, en grados: positivo hunde el borde derecho. */
  ry: number;
  /** Dónde está el puntero, de 0 (izquierda) a 1 (derecha). */
  gx: number;
  /** Dónde está el puntero, de 0 (arriba) a 1 (abajo). */
  gy: number;
};

type Punto = { x: number; y: number };
type Marco = { left: number; top: number; width: number; height: number };

const acotar = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);
const redondear = (v: number, decimales = 2) => {
  const f = 10 ** decimales;
  // `+ 0` convierte el -0 en 0: en el centro no hay inclinación hacia ningún lado.
  return Math.round(v * f) / f + 0;
};

export function inclinacion(punto: Punto, marco: Marco): Inclinacion {
  const gx = marco.width > 0 ? acotar((punto.x - marco.left) / marco.width) : 0.5;
  const gy = marco.height > 0 ? acotar((punto.y - marco.top) / marco.height) : 0.5;
  return {
    rx: redondear((0.5 - gy) * 2 * INCLINACION_MAXIMA.x),
    ry: redondear((gx - 0.5) * 2 * INCLINACION_MAXIMA.y),
    gx: redondear(gx, 3),
    gy: redondear(gy, 3),
  };
}
