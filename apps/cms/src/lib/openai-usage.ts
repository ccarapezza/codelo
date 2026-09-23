// El consumo de OpenAI del mes, leído de la Admin API.
//
// Vive en lib/ y no dentro del controller para que se pueda probar: importar un
// controller arrastra @strapi/core entero, que no carga fuera del servidor.
//
// ⚠️ Estos endpoints NO son los de la aplicación. Piden una Admin key de la
// ORGANIZACIÓN (`sk-admin-…`) y ninguno devuelve saldo: OpenAI es pospago y no
// publica créditos restantes. Lo que hay es consumo:
//
//   /v1/organization/costs              dólares, agrupables por line_item
//   /v1/organization/usage/completions  tokens de entrada, cacheados y salida
//   /v1/organization/usage/images       imágenes
//
// Todo falla suave: es una tarjeta informativa y no puede romper la pantalla de
// configuración.

const BASE = "https://api.openai.com/v1/organization";

export interface ModelUsage {
  model: string;
  tokensIn?: number;
  tokensCached?: number;
  tokensOut?: number;
  images?: number;
  requests?: number;
}

export interface OpenAIUsage {
  monthlyCost: number;
  models: ModelUsage[];
}

type Fetcher = (url: string, key: string) => Promise<any | null>;

const fetchJson: Fetcher = async (url, key) => {
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
};

/** Medianoche UTC del día 1 del mes en curso, en segundos. */
export function inicioDelMes(ahora = new Date()): number {
  return Math.floor(new Date(ahora.toISOString().slice(0, 7) + "-01T00:00:00Z").getTime() / 1000);
}

/**
 * Recorre un endpoint juntando los `results` de cada bucket.
 *
 * ⚠️ Los buckets son de UN DÍA y el tope de `limit` es 31 en los endpoints de
 * uso (180 en el de costos): un mes entra justo, pero "justo" no es "seguro" y
 * quedarse en la primera página no da error, da un número más chico. Por eso
 * sigue `next_page`, con tope de vueltas para que un `has_more` que nunca baje
 * no cuelgue la pantalla.
 */
export async function juntarBuckets(
  ruta: string,
  key: string,
  params: Record<string, string>,
  opts: { base?: string; fetcher?: Fetcher } = {},
): Promise<any[]> {
  const base = opts.base ?? BASE;
  const get = opts.fetcher ?? fetchJson;
  const out: any[] = [];
  let page: string | undefined;
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const qs = new URLSearchParams(params);
    if (page) qs.set("page", page);
    const data = await get(`${base}/${ruta}?${qs}`, key);
    if (!data) break;
    for (const bucket of data.data ?? []) out.push(...(bucket.results ?? []));
    if (!data.has_more || !data.next_page) break;
    page = data.next_page;
  }
  return out;
}

/** Suma por modelo, descartando las filas que no traen ninguna métrica. */
export function porModelo(filas: any[], campos: Record<string, string>): ModelUsage[] {
  const acc = new Map<string, Record<string, number>>();
  for (const f of filas) {
    const modelo = typeof f?.model === "string" && f.model ? f.model : "(sin modelo)";
    const fila = acc.get(modelo) ?? {};
    for (const [destino, origen] of Object.entries(campos)) {
      const v = f?.[origen];
      if (typeof v === "number" && Number.isFinite(v)) fila[destino] = (fila[destino] ?? 0) + v;
    }
    if (Object.keys(fila).length > 0) acc.set(modelo, fila);
  }
  // El más usado primero: es el que explica la factura.
  const peso = (x: Record<string, number>) => x.tokensIn ?? x.images ?? x.requests ?? 0;
  return [...acc.entries()]
    .map(([model, v]) => ({ model, ...v }) as ModelUsage)
    .sort((a, b) => peso(b as never) - peso(a as never));
}

/** El costo y el desglose por modelo del mes en curso. */
export async function consumoDelMes(
  adminKey: string,
  opts: { base?: string; fetcher?: Fetcher; ahora?: Date } = {},
): Promise<OpenAIUsage> {
  const comun = { start_time: String(inicioDelMes(opts.ahora)), bucket_width: "1d" };
  const [costos, completions, imagenes] = await Promise.all([
    juntarBuckets("costs", adminKey, { ...comun, limit: "180", group_by: "line_item" }, opts),
    juntarBuckets("usage/completions", adminKey, { ...comun, limit: "31", group_by: "model" }, opts),
    juntarBuckets("usage/images", adminKey, { ...comun, limit: "31", group_by: "model" }, opts),
  ]);

  const monthlyCost = costos.reduce(
    (t: number, r: any) => (typeof r?.amount?.value === "number" ? t + r.amount.value : t),
    0,
  );

  return {
    monthlyCost: +monthlyCost.toFixed(4),
    models: [
      ...porModelo(completions, {
        tokensIn: "input_tokens",
        tokensCached: "input_cached_tokens",
        tokensOut: "output_tokens",
        requests: "num_model_requests",
      }),
      ...porModelo(imagenes, { images: "images", requests: "num_model_requests" }),
    ],
  };
}
