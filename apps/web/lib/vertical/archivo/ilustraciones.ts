// Ilustraciones de archivo: una por tipo de nota, y una propia para la
// investigación sobre los monos de Heath. Grabados a dos tintas (tinta y ámbar
// del logo) sobre papel, como las láminas de la casa, sin personas y sin texto.
//
// La mayoría de las notas viejas tiene, además, una lámina propia del mismo
// estilo, que vive solo en el CMS y llega por el manifiesto (notas.ts) con su
// texto alternativo. Estas quedan para las notas sin lámina propia y como
// respaldo mientras una nota no está importada.
//
// Las genera portadas.py en el repo de secretaría, y generar_manifiesto.py
// --portadas las pasa a public/archivo/portadas/ igual que importar.py las sube
// al CMS como portada de cada nota: son la misma imagen, con el mismo texto
// alternativo (el de acá).
//
// Al reemplazar un arte hay que cambiarle el NOMBRE al archivo: el optimizador
// de next/image cachea por URL (ver lib/vertical/laminas.ts).

import type { Portada, TipoNota } from "./tipos";

export type IlustracionId =
  "entrevista" | "cronica" | "informe" | "pronunciamiento" | "cronologia" | "heath";

export type IlustracionArchivo = Portada & {
  src: `/archivo/portadas/${IlustracionId}.webp`;
  clase: "ilustracion";
};

export const ILUSTRACIONES: Record<IlustracionId, IlustracionArchivo> = {
  entrevista: {
    src: "/archivo/portadas/entrevista.webp",
    width: 1600,
    height: 893,
    alt: "Grabado a dos tintas: un grabador de casete, un micrófono de mesa, una libreta y una planta de cannabis en maceta",
    clase: "ilustracion",
  },
  cronica: {
    src: "/archivo/portadas/cronica.webp",
    width: 1600,
    height: 893,
    alt: "Grabado a dos tintas: una cámara de fuelle, una libreta abierta con una lapicera y frascos con flores",
    clase: "ilustracion",
  },
  informe: {
    src: "/archivo/portadas/informe.webp",
    width: 1600,
    height: 893,
    alt: "Grabado a dos tintas: documentos atados con cinta y lacre, y una lupa sobre una hoja de cannabis",
    clase: "ilustracion",
  },
  pronunciamiento: {
    src: "/archivo/portadas/pronunciamiento.webp",
    width: 1600,
    height: 893,
    alt: "Grabado a dos tintas: un puño en alto con un ramo de flores y rayos de sol",
    clase: "ilustracion",
  },
  cronologia: {
    src: "/archivo/portadas/cronologia.webp",
    width: 1600,
    height: 893,
    alt: "Grabado a dos tintas: una enredadera con medallones que avanza hacia un sol naciente",
    clase: "ilustracion",
  },
  heath: {
    src: "/archivo/portadas/heath.webp",
    width: 1600,
    height: 888,
    alt: "Grabado a dos tintas: una máscara de gas, una campana de vidrio y un cerebro sobre una mesa de laboratorio, junto a una ventana abierta a la noche por la que sale un mono",
    clase: "ilustracion",
  },
};

/** La ilustración de cada tipo. La investigación nueva tiene la suya. */
export const ILUSTRACION_DE_TIPO: Record<TipoNota, IlustracionId> = {
  entrevista: "entrevista",
  cronica: "cronica",
  informe: "informe",
  pronunciamiento: "pronunciamiento",
  cronologia: "cronologia",
  investigacion: "heath",
};
