// Los pools con los que se sortean las portadas: encuadre, tratamiento,
// iluminación y acabado de ilustración.
//
// Es una COSTURA: el motor trae pools genéricos (lib/cover-pools.ts) y un
// proyecto puede reemplazar cualquiera de los cuatro con luces, encuadres o
// tratamientos propios de su tema. Lo que no se declara acá sigue siendo del
// motor. Para sumar a un pool del motor en vez de reemplazarlo, partir de
// ENGINE_POOLS: `moods: [...ENGINE_POOLS.moods, { tone: "night", value: "…" }]`.
//
// ⚠️ Un pool propio REEMPLAZA entero al del motor, no se suma: la elección es
// por hash de la nota, así que el tamaño y el orden de la lista deciden qué le
// toca a cada una. Un array vacío se ignora (queda el del motor).

import type { CoverPools } from "../lib/cover-pools";

export const verticalCoverPools: Partial<CoverPools> = {};
