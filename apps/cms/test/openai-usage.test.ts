// El agregador de consumo de OpenAI, contra respuestas con la forma real de la
// Admin API.
//
// Las tres cosas que se rompen en silencio acá: quedarse en la primera página
// (no da error, da un número más chico), perder un modelo porque una fila no
// trae la métrica que se busca, y mezclar tokens con imágenes, que se cuentan
// distinto y en unidades distintas.

import { describe, expect, it } from "vitest";
import { consumoDelMes, inicioDelMes, juntarBuckets, porModelo } from "../src/lib/openai-usage";

/** Sirve páginas enlatadas por ruta, respetando el cursor `page`. */
function servidorFalso(paginas: Record<string, any[]>) {
  const pedidos: Array<{ ruta: string; params: URLSearchParams }> = [];
  const fetcher = async (url: string) => {
    const u = new URL(url);
    const ruta = u.pathname.replace(/^\/org\//, "");
    pedidos.push({ ruta, params: u.searchParams });
    const p = paginas[ruta];
    if (!p) return null;
    return p[u.searchParams.get("page") === "p2" ? 1 : 0] ?? p[p.length - 1];
  };
  return { fetcher, pedidos, base: "https://falso.local/org" };
}

const COSTOS_EN_DOS_PAGINAS = [
  { data: [{ results: [{ amount: { value: 2.9, currency: "usd" }, line_item: "gpt-4o-mini" }] }], has_more: true, next_page: "p2" },
  { data: [{ results: [{ amount: { value: 1.28, currency: "usd" }, line_item: "gpt-image-1-mini" }] }], has_more: false, next_page: null },
];

const COMPLETIONS = [
  {
    data: [
      { results: [{ input_tokens: 800000, input_cached_tokens: 120000, output_tokens: 90000, num_model_requests: 310, model: "gpt-4o-mini" }] },
      { results: [
        { input_tokens: 400000, input_cached_tokens: 0, output_tokens: 90000, num_model_requests: 96, model: "gpt-4o-mini" },
        { input_tokens: 51000, output_tokens: 8000, num_model_requests: 12, model: "gpt-4.1-mini" },
      ] },
    ],
    has_more: false,
    next_page: null,
  },
];

const IMAGENES = [
  { data: [{ results: [{ images: 48, num_model_requests: 48, model: "gpt-image-1-mini" }] }], has_more: false, next_page: null },
];

describe("juntarBuckets", () => {
  it("sigue next_page en vez de quedarse en la primera página", async () => {
    // Es el fallo caro: no da error, da un número más chico.
    const s = servidorFalso({ costs: COSTOS_EN_DOS_PAGINAS });
    const filas = await juntarBuckets("costs", "sk-admin-x", { limit: "180" }, s);
    expect(filas).toHaveLength(2);
    expect(s.pedidos).toHaveLength(2);
    expect(s.pedidos[1].params.get("page")).toBe("p2");
  });

  it("corta si la respuesta es null en vez de reintentar para siempre", async () => {
    const filas = await juntarBuckets("costs", "k", {}, { base: "https://x/org", fetcher: async () => null });
    expect(filas).toEqual([]);
  });

  it("no da más de seis vueltas aunque has_more nunca baje", async () => {
    // Un has_more pegado en true colgaría la pantalla de configuración.
    let vueltas = 0;
    await juntarBuckets("costs", "k", {}, {
      base: "https://x/org",
      fetcher: async () => { vueltas++; return { data: [], has_more: true, next_page: "siempre" }; },
    });
    expect(vueltas).toBe(6);
  });
});

describe("porModelo", () => {
  it("suma los buckets del mismo modelo", () => {
    const r = porModelo(COMPLETIONS[0].data.flatMap((b) => b.results), {
      tokensIn: "input_tokens", tokensOut: "output_tokens", requests: "num_model_requests",
    });
    expect(r[0]).toMatchObject({ model: "gpt-4o-mini", tokensIn: 1200000, tokensOut: 180000, requests: 406 });
  });

  it("ordena por uso: primero el que explica la factura", () => {
    const r = porModelo(COMPLETIONS[0].data.flatMap((b) => b.results), { tokensIn: "input_tokens" });
    expect(r.map((x) => x.model)).toEqual(["gpt-4o-mini", "gpt-4.1-mini"]);
  });

  it("descarta las filas sin ninguna de las métricas pedidas", () => {
    // Si no, un modelo aparecería en la lista con todo en blanco.
    const r = porModelo([{ model: "x", otra_cosa: 5 }], { tokensIn: "input_tokens" });
    expect(r).toEqual([]);
  });

  it("agrupa bajo «(sin modelo)» en vez de perder la fila", () => {
    const r = porModelo([{ input_tokens: 10 }], { tokensIn: "input_tokens" });
    expect(r[0]).toMatchObject({ model: "(sin modelo)", tokensIn: 10 });
  });
});

describe("consumoDelMes", () => {
  it("junta costo, tokens e imágenes en una sola lectura", async () => {
    const s = servidorFalso({
      costs: COSTOS_EN_DOS_PAGINAS,
      "usage/completions": COMPLETIONS,
      "usage/images": IMAGENES,
    });
    const r = await consumoDelMes("sk-admin-x", s);

    expect(r.monthlyCost).toBe(4.18); // las dos páginas
    expect(r.models.map((m) => m.model)).toEqual(["gpt-4o-mini", "gpt-4.1-mini", "gpt-image-1-mini"]);
    expect(r.models[0].tokensCached).toBe(120000);
    // Las imágenes se cuentan en imágenes, no en tokens.
    const img = r.models.find((m) => m.model === "gpt-image-1-mini")!;
    expect(img.images).toBe(48);
    expect(img.tokensIn).toBeUndefined();
  });

  it("pide buckets de un día y el tope de limit que admite cada endpoint", async () => {
    // 1d es el único bucket_width del endpoint de costos, y el limit de los de
    // uso llega a 31: con menos, un mes largo se corta.
    const s = servidorFalso({ costs: [], "usage/completions": [], "usage/images": [] });
    await consumoDelMes("k", s);
    expect(s.pedidos.every((p) => p.params.get("bucket_width") === "1d")).toBe(true);
    expect(s.pedidos.find((p) => p.ruta === "usage/completions")!.params.get("limit")).toBe("31");
    expect(s.pedidos.find((p) => p.ruta === "costs")!.params.get("limit")).toBe("180");
  });

  it("un mes sin consumo devuelve cero y lista vacía, no un error", async () => {
    const s = servidorFalso({ costs: [], "usage/completions": [], "usage/images": [] });
    await expect(consumoDelMes("k", s)).resolves.toEqual({ monthlyCost: 0, models: [] });
  });
});

describe("inicioDelMes", () => {
  it("es medianoche UTC del día 1", () => {
    const t = inicioDelMes(new Date("2026-09-23T14:32:00.000Z"));
    expect(new Date(t * 1000).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
});
