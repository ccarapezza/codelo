// Contenido propio de ESTE sitio: la agenda de actividades de terceros y el
// archivo de normas del Boletín Oficial.

import {
  getCmsBaseUrl,
  proxiedUrl,
  type StrapiCollection,
  type StrapiEvent,
} from "@/lib/cms-fetch";

export type CmsEvent = {
  title: string;
  slug: string;
  startsAt: string;
  endsAt: string | null;
  place: string | null;
  /** Quién organiza. La asociación agenda estos eventos, no los organiza. */
  organizer: string | null;
  /** Sitio oficial del evento, para verificar en la fuente. */
  sourceUrl: string | null;
  description: string | null;
  coverImageUrl: string | null;
};

export async function getEvents(opts?: {
  upcomingOnly?: boolean;
  limit?: number;
}): Promise<CmsEvent[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  const url = new URL(`${baseUrl}/api/events`);
  url.searchParams.set("populate", "coverImage");
  url.searchParams.set("pagination[pageSize]", String(opts?.limit ?? 50));
  if (opts?.upcomingOnly) {
    url.searchParams.set("filters[startsAt][$gte]", new Date().toISOString());
    url.searchParams.set("sort", "startsAt:asc");
  } else {
    url.searchParams.set("sort", "startsAt:desc");
  }

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!response.ok) return [];
    const json = (await response.json()) as StrapiCollection<StrapiEvent>;
    return json.data.map(e => ({
      title: e.title,
      slug: e.slug,
      startsAt: e.startsAt,
      endsAt: e.endsAt ?? null,
      place: e.place ?? null,
      organizer: e.organizer ?? null,
      sourceUrl: e.sourceUrl ?? null,
      description: e.description ?? null,
      coverImageUrl: proxiedUrl(e.coverImage?.url),
    }));
  } catch {
    return [];
  }
}

/**
 * Una norma del Boletín Oficial con su ficha de lectura.
 *
 * La ficha la produce el vigilante normativo del CMS leyendo el texto íntegro
 * de la norma (ver `src/lib/boletin-analisis.ts` allá). Sólo llegan acá las que
 * el triage consideró relevantes: el resto queda archivado pero no se publica.
 */

export type BoletinEntry = {
  titulo: string;
  /** Identificación de la norma, p. ej. "Resolución 653/2023". */
  norma: string | null;
  url: string;
  /** Rubro del Boletín: LEYES, DECRETOS, RESOLUCIONES… */
  rubro: string | null;
  organismo: string | null;
  publishedAt: string | null;
  /** Resumen en lenguaje llano. Null sólo si el análisis no lo pudo producir. */
  resumen: string | null;
  queCambia: string[];
  aQuienAfecta: string[];
  /** Sólo si la norma lo dice explícitamente; nunca inferido. */
  vigencia: string | null;
  pasos: string[];
  normasCitadas: string[];
};

/**
 * Saca un extracto legible del texto de una norma.
 *
 * El cuerpo guardado es el texto íntegro y abre con la fórmula de estilo:
 * "Ciudad de Buenos Aires, 26/06/2026 VISTO el Expediente EX-2026-…, las Leyes
 * Nros. 20.247, 25.845…". Eso dice de qué expediente viene, no de qué se
 * trata: como descripción no sirve. La sustancia arranca después del
 * CONSIDERANDO, en el primer "Que …", que es donde la norma explica su motivo.
 *
 * Es el FALLBACK: lo normal es mostrar el `resumen` de la ficha. Esto queda
 * para las normas cuyo análisis todavía no corrió o falló, donde un extracto
 * mediocre del texto real es mejor que un hueco.
 */
function boletinExcerpt(summary: string | null | undefined, max = 190): string | null {
  if (!summary) return null;
  let text = summary.trim();

  const considerando = text.search(/CONSIDERANDO\s*:?/i);
  if (considerando !== -1) {
    text = text.slice(considerando).replace(/^CONSIDERANDO\s*:?\s*/i, "");
  } else {
    // Sin CONSIDERANDO (los avisos oficiales no lo tienen) se descarta solo el
    // encabezado de ciudad y fecha, que tampoco aporta.
    text = text.replace(/^Ciudad de [^,]+,\s*\d{2}\/\d{2}\/\d{4}\s*/i, "");
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text || null;

  // Cortar en el último límite de palabra para no partir a la mitad.
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:]$/, "")}…`;
}

/**
 * El título a mostrar, o null si no aporta nada.
 *
 * En el Boletín, muchas entradas de la Primera Sección llevan como título el
 * organismo que dicta la norma ("MINISTERIO DE SEGURIDAD NACIONAL"), en
 * mayúsculas y sin decir de qué se trata. Con el organismo ya en el encabezado
 * de la ficha, repetirlo como titular es ruido: el asunto real está en el
 * resumen. Cuando el título sí dice algo, se muestra.
 */
export function boletinTitulo(entry: BoletinEntry): string | null {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const titulo = norm(entry.titulo);
  const organismo = entry.organismo ? norm(entry.organismo) : "";
  if (!titulo) return null;
  if (!organismo) return entry.titulo;

  if (titulo === organismo || organismo.includes(titulo) || titulo.includes(organismo)) return null;

  // Caso acrónimo: el título trae el nombre desplegado ("ADMINISTRACIÓN
  // NACIONAL DE MEDICAMENTOS, ALIMENTOS Y TECNOLOGÍA MÉDICA") y el análisis
  // extrajo la sigla ("ANMAT"). Las iniciales de las palabras largas del título
  // arrancan con la sigla, y con eso alcanza para detectarlo.
  const iniciales = titulo
    .split(" ")
    .filter(w => w.length > 2)
    .map(w => w[0])
    .join("");
  const sigla = organismo.replace(/ /g, "");
  if (sigla.length >= 3 && (iniciales.startsWith(sigla) || sigla.startsWith(iniciales))) return null;

  return entry.titulo;
}

type StrapiNorma = {
  titulo: string;
  norma: string | null;
  url: string;
  rubro: string | null;
  organismo: string | null;
  publicadaEl: string | null;
  resumen: string | null;
  queCambia: unknown;
  aQuienAfecta: unknown;
  vigencia: string | null;
  pasos: unknown;
  normasCitadas: unknown;
  textoCompleto: string | null;
};

/** Los campos de lista son `json` en Strapi: puede volver cualquier cosa. */
function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

function toBoletinEntry(item: StrapiNorma): BoletinEntry {
  return {
    titulo: item.titulo,
    norma: item.norma,
    url: item.url,
    rubro: item.rubro,
    organismo: item.organismo,
    publishedAt: item.publicadaEl,
    resumen: item.resumen ?? boletinExcerpt(item.textoCompleto),
    queCambia: stringList(item.queCambia),
    aQuienAfecta: stringList(item.aQuienAfecta),
    vigencia: item.vigencia,
    pasos: stringList(item.pasos),
    normasCitadas: stringList(item.normasCitadas),
  };
}

const NORMA_FIELDS = [
  "titulo",
  "norma",
  "url",
  "rubro",
  "organismo",
  "publicadaEl",
  "resumen",
  "queCambia",
  "aQuienAfecta",
  "vigencia",
  "pasos",
  "normasCitadas",
  "textoCompleto",
];

function normasUrl(baseUrl: string, limit: number, page = 1): URL {
  const url = new URL(`${baseUrl}/api/normas`);
  NORMA_FIELDS.forEach((f, i) => url.searchParams.set(`fields[${i}]`, f));
  // Sólo lo que el triage marcó relevante Y pudo leer: `descartada` es ruido y
  // `pendiente`/`error` todavía no tienen ficha.
  url.searchParams.set("filters[analisisEstado][$eq]", "listo");
  url.searchParams.set("sort", "publicadaEl:desc");
  url.searchParams.set("pagination[pageSize]", String(limit));
  url.searchParams.set("pagination[page]", String(page));
  return url;
}

/**
 * Últimas normas relevadas del Boletín Oficial, con su ficha de lectura.
 *
 * Es el material del riel lateral de la home: a diferencia de un "últimas
 * noticias" genérico, muestra cambios regulatorios en su fuente primaria y
 * explica qué cambian, que es lo que un lector de esta asociación necesita.
 */
export async function getBoletinEntries(limit = 6): Promise<BoletinEntry[]> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return [];

  try {
    const response = await fetch(normasUrl(baseUrl, limit).toString(), {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { data: StrapiNorma[] };
    return (json.data ?? []).map(toBoletinEntry);
  } catch {
    return [];
  }
}

/** Igual que getBoletinEntries pero con el total, para paginar /normativa. */
export async function getBoletinPage(
  page = 1,
  pageSize = 20,
): Promise<{ entries: BoletinEntry[]; total: number }> {
  const baseUrl = getCmsBaseUrl();
  if (!baseUrl) return { entries: [], total: 0 };

  try {
    const response = await fetch(normasUrl(baseUrl, pageSize, page).toString(), {
      next: { revalidate: 300 },
    });
    if (!response.ok) return { entries: [], total: 0 };
    const json = (await response.json()) as {
      data: StrapiNorma[];
      meta?: { pagination?: { total?: number } };
    };
    return {
      entries: (json.data ?? []).map(toBoletinEntry),
      total: json.meta?.pagination?.total ?? 0,
    };
  } catch {
    return { entries: [], total: 0 };
  }
}
