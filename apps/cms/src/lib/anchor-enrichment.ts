// Enriquecer las anclas de una portada con conocimiento del vertical.
//
// Las anclas las extrae un modelo de texto de la nota (openai.ts,
// extractArticleAnchors) y llegan al prompt de imagen como "MUST FEATURE". Un
// vertical sabe cosas que el modelo no: que tal club se reconoce por las
// franjas de su camiseta y no por un escudo, que tal especie se dibuja con tal
// hoja. La costura (verticals/anchor-enrichers.ts) le deja agregar esas líneas
// y descartar un ancla que la suya vuelve redundante o riesgosa.

import { anchorEnrichers } from "../verticals/anchor-enrichers";

/** Lo que devuelve un enriquecedor. `null` = no tiene nada que decir de esta nota. */
export interface AnchorEnrichment {
  /** Líneas completas para "MUST FEATURE", con su "- " (en inglés, como el prompt). */
  lines?: string[];
  /** Claves de anclas a omitir: las reemplaza una línea propia más precisa. */
  drop?: string[];
}

export type AnchorEnricher = (
  anchors: Readonly<Record<string, string | null>>,
) => AnchorEnrichment | null;

/**
 * Corre los enriquecedores sobre las anclas y junta lo que devuelven.
 *
 * Cada uno va en su propio try: un enriquecedor que lanza se ignora y la
 * portada sale igual, con las anclas del modelo. Una excepción de un vertical
 * no puede dejar una nota sin imagen.
 */
export function applyAnchorEnrichers(
  anchors: Readonly<Record<string, string | null>>,
  enrichers: readonly AnchorEnricher[] = anchorEnrichers,
): { lines: string[]; drop: Set<string> } {
  const lines: string[] = [];
  const drop = new Set<string>();
  for (const enriquecer of enrichers) {
    try {
      const r = enriquecer(anchors);
      if (!r) continue;
      for (const l of r.lines ?? []) if (l.trim()) lines.push(l);
      for (const k of r.drop ?? []) drop.add(k);
    } catch (err) {
      console.warn(`[anchor-enrichment] un enriquecedor falló y se ignora: ${(err as Error).message}`);
    }
  }
  return { lines, drop };
}
