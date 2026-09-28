// Google News como DIRECTORIO DE MEDIOS por país, no como fuente de noticias.
//
// El buscador de fuentes se apoyaba sólo en Feedly, y su catálogo en castellano
// es de España. Medido el 24/09/2026 contra su API: `gastronomía` devuelve 20
// feeds y NINGUNO argentino; `gastronomía argentina`, `cocina argentina`,
// `vino mendoza` y `restaurantes buenos aires` devuelven CERO. No es que los
// perdiéramos por una consulta mal armada: no están en el índice.
//
// Google News sí tiene ediciones por país. Pero sus ítems NO sirven como feed:
// el `<link>` apunta a `news.google.com/rss/articles/CBMi…`, que devuelve una
// página de redirección por JavaScript sin contenido, y la URL del medio no
// viene codificada adentro (probado: decodificar el id en base64 no la trae).
// Tomarlo como feed daría notas sin cuerpo y, peor, citaría a Google como
// fuente en lugar del medio que publicó.
//
// Lo que sí trae cada ítem es `<source url="…">` con el medio REAL. Entonces se
// lo usa como guía: de una consulta salen las publicaciones que están cubriendo
// ese tema en ese país, y a cada una se le busca su propio RSS con el
// autodiscovery que el motor ya tiene. Medido sobre "vino OR bodega OR
// gastronomía" en Argentina: 100 ítems, 72 medios distintos, 28 con dominio
// .ar, y el autodiscovery les encuentra feed a cerca de la mitad — entre ellos
// enolife.com.ar, que es exactamente el tipo de medio de nicho que faltaba.

import { esUrlPublica } from "./url-guard";

/** Ediciones que ofrece el panel. `gl` es el país; `hl`/`ceid`, el idioma. */
export const EDICIONES = [
  { code: "AR", label: "Argentina", hl: "es-419", ceid: "AR:es-419" },
  { code: "MX", label: "México", hl: "es-419", ceid: "MX:es-419" },
  { code: "CL", label: "Chile", hl: "es-419", ceid: "CL:es-419" },
  { code: "CO", label: "Colombia", hl: "es-419", ceid: "CO:es-419" },
  { code: "PE", label: "Perú", hl: "es-419", ceid: "PE:es-419" },
  { code: "UY", label: "Uruguay", hl: "es-419", ceid: "UY:es-419" },
  { code: "ES", label: "España", hl: "es", ceid: "ES:es" },
  { code: "US", label: "Estados Unidos (inglés)", hl: "en-US", ceid: "US:en" },
  { code: "GB", label: "Reino Unido (inglés)", hl: "en-GB", ceid: "GB:en" },
] as const;

export type CodigoEdicion = (typeof EDICIONES)[number]["code"];

export function esEdicionValida(code: string | null | undefined): code is CodigoEdicion {
  return !!code && EDICIONES.some((e) => e.code === code);
}

/** La URL de búsqueda de Google News para un tema y una edición. */
export function urlBusqueda(query: string, code: CodigoEdicion): string {
  const ed = EDICIONES.find((e) => e.code === code)!;
  // Las palabras se unen con OR: Google News trata el espacio como AND y una
  // consulta de cuatro términos deja de traer resultados.
  const term = query
    .split(/[\s,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2)
    .slice(0, 6)
    .join(" OR ");
  const q = encodeURIComponent(term || query.trim());
  return `https://news.google.com/rss/search?q=${q}&hl=${ed.hl}&gl=${ed.code}&ceid=${encodeURIComponent(ed.ceid)}`;
}

export type MedioDetectado = {
  /** El host, sin `www.`. */
  host: string;
  /** Cómo lo nombra Google News. */
  nombre: string;
  /** Cuántos ítems de la consulta publicó: sirve para ordenar por relevancia. */
  items: number;
};

/**
 * Los medios que están cubriendo ese tema en esa edición, más frecuentes
 * primero.
 *
 * Exportada aparte del fetch para poder testear el parseo sin red.
 */
export function medioDesdeXml(xml: string): MedioDetectado[] {
  const porHost = new Map<string, MedioDetectado>();
  const re = /<source\s+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const [, url, nombreCrudo] = m;
    if (!esUrlPublica(url)) continue;
    let host: string;
    try {
      host = new URL(url).host.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!host) continue;
    const nombre = nombreCrudo.replace(/<!\[CDATA\[|\]\]>/g, "").trim() || host;
    const previo = porHost.get(host);
    if (previo) previo.items += 1;
    else porHost.set(host, { host, nombre, items: 1 });
  }
  return [...porHost.values()].sort((a, b) => b.items - a.items);
}

/** Pide la edición y devuelve los medios que aparecen. Falla suave: `[]`. */
export async function buscarMedios(
  query: string,
  code: CodigoEdicion,
  userAgent: string,
  timeoutMs = 12000,
): Promise<MedioDetectado[]> {
  try {
    const res = await fetch(urlBusqueda(query, code), {
      headers: { "User-Agent": userAgent },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow",
    });
    if (!res.ok) return [];
    return medioDesdeXml(await res.text());
  } catch {
    // Google News no es una API con contrato: si cambia o no responde, el
    // buscador sigue andando con Feedly y autodiscovery.
    return [];
  }
}
