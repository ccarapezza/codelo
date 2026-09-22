// La configuración editorial de ESTE proyecto, para cargarla una sola vez.
//
// Es una COSTURA, y la única que contiene texto editorial. El motor la aplica
// en el arranque (lib/seed-runner.ts) y rellena SÓLO los campos que estén
// vacíos: lo que ya se editó desde el panel siempre gana.
//
// Después de la primera corrida, la fuente de verdad es la base. Este archivo
// queda como el punto de partida versionado —útil para levantar otra instancia
// del mismo proyecto o para ver de dónde salió un texto—, pero editarlo NO
// cambia nada de lo que ya está cargado: eso se hace desde Configuración
// editorial.
//
// Para un proyecto nuevo: dejarlo vacío y configurar desde el panel, o escribir
// acá los valores y dejar que la primera corrida los cargue. Las dos formas
// terminan igual.

import type { ProjectSeed } from "../lib/seed-runner";

export const seeds: ProjectSeed[] = [];
