// Conocimiento del vertical sobre las anclas de una portada.
//
// Es una COSTURA: el motor extrae de cada nota sus anclas visuales —tema,
// paleta, lugar, lo que declare la taxonomía— y las pide como "MUST FEATURE" en
// el prompt de imagen. Un enriquecedor recibe esas anclas y puede sumar líneas
// propias o descartar alguna (ver lib/anchor-enrichment.ts). Sin enriquecedores
// las anclas llegan tal cual, que es lo que hace el motor por su cuenta.
//
// Un enriquecedor que lanza se ignora: nunca deja una nota sin portada.

import type { AnchorEnricher } from "../lib/anchor-enrichment";

export const anchorEnrichers: readonly AnchorEnricher[] = [];
