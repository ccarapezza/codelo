// Ilustraciones propias de la sección (dirección "Noche cósmica", 06/10/2026),
// versionadas en public/copa-cata/ilustraciones/. Las genera y publica el paso
// 08_ilustraciones.py del repo de secretaría: dos tintas —ámbar y papel— sobre
// la noche, sin personas, sin texto y sin logos. El texto de cada una (alt) se
// escribe a mano acá y describe la ilustración sin nombrar marcas.
//
// Al reemplazar un arte hay que cambiarle el NOMBRE al archivo: el optimizador
// de next/image cachea por URL (ver lib/vertical/laminas.ts).

import type { Anio } from "./tipos";

export type Ilustracion = {
  src: `/copa-cata/ilustraciones/${string}.webp`;
  width: number;
  height: number;
  /** Vacío solo en los ornamentos, que son decoración pura. */
  alt: string;
};

/** La portada, apaisada (16:9). */
export const ILUSTRACION_PORTADA: Ilustracion = {
  src: "/copa-cata/ilustraciones/portada.webp",
  width: 2048,
  height: 1143,
  alt: "Ilustración en ámbar y papel sobre el cielo de noche: una copa desbordada de flores de cannabis, con un sol enorme detrás, órbitas con planetas, constelaciones que dibujan hojas, semillas, frascos y una lupa girando alrededor.",
};

/** Una por edición, verticales (4:5). */
export const ILUSTRACION_EDICION: Record<Anio, Ilustracion> = {
  2014: {
    src: "/copa-cata/ilustraciones/edicion-2014.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: una mesa redonda con frascos de flores y una copa chica, brotes que nacen alrededor, una luna creciente, un sol y constelaciones.",
  },
  2015: {
    src: "/copa-cata/ilustraciones/edicion-2015.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: una copa con la silueta de una flor de cannabis, rodeada de mesas de cata dispuestas en círculos, plantas en flor y un sol radiante.",
  },
  2016: {
    src: "/copa-cata/ilustraciones/edicion-2016.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: una copa dorada grabada con una hoja, enmarcada por volutas y plantas en flor, bajo un cielo con luna, órbitas y constelaciones.",
  },
  2017: {
    src: "/copa-cata/ilustraciones/edicion-2017.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: una copa hecha de engranajes y relojería, con tres hojas de filigrana que nacen de ella, plantas en flor a los costados y un sol y una luna detrás.",
  },
  2018: {
    src: "/copa-cata/ilustraciones/edicion-2018.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: amanecer sobre las terrazas de un barrio, con tanques de agua y árboles, y plantas en macetas en primer plano bajo un sol ámbar con anillos.",
  },
  2019: {
    src: "/copa-cata/ilustraciones/edicion-2019.webp",
    width: 1112,
    height: 1400,
    alt: "Ilustración: una mesa de noche con una prensa de extracción, frascos de resina y bandejas de flores, bajo una guirnalda de luces y una luna con anillos.",
  },
  2021: {
    src: "/copa-cata/ilustraciones/edicion-2021.webp",
    width: 1105,
    height: 1400,
    alt: "Ilustración: una carpa blanca iluminada por dentro, al aire libre, rodeada de plantas en macetas, faroles y almohadones, bajo un sol con órbitas y la Vía Láctea.",
  },
  2022: {
    src: "/copa-cata/ilustraciones/edicion-2022.webp",
    width: 1128,
    height: 1400,
    alt: "Ilustración: una flor hecha de galaxias y estrellas que flota entre órbitas, sobre plantas en flor y una galaxia en espiral.",
  },
};

/**
 * Ornamentos: bandas sobre fondo de tinta que se imprimen con
 * `mix-blend-mode: screen`, así el fondo desaparece y queda solo el trazo. Son
 * decoración pura y van con `alt` vacío; `descripcion` es para quien edita.
 */
export const ORNAMENTOS = {
  /** Banda de órbitas con flores, un sol y lunas: separa bloques. */
  orbitas: {
    src: "/copa-cata/ilustraciones/orbitas.webp",
    width: 1584,
    height: 672,
    alt: "",
    descripcion: "Banda de órbitas cruzadas con flores, un sol y lunas.",
  },
  /** Una luna con anillo y un ramo de plantas que crece desde abajo: cierra la página. */
  jardin: {
    src: "/copa-cata/ilustraciones/jardin.webp",
    width: 1584,
    height: 431,
    alt: "",
    descripcion: "Una luna con anillo sobre un ramo de plantas que crece desde el borde de abajo.",
  },
  /** Campo de estrellas que se repite sin cortes: el cielo de fondo. */
  estrellas: {
    src: "/copa-cata/ilustraciones/estrellas.webp",
    width: 900,
    height: 900,
    alt: "",
    descripcion: "Campo de estrellas en ámbar y papel, repetible como mosaico.",
  },
} satisfies Record<string, Ilustracion & { descripcion: string }>;
