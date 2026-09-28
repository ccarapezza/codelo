// Prueba EN VIVO del buscador de fuentes. Sólo corre con FEEDS_LIVE=1.
// Acá viven las aserciones que distinguen "Feedly cambió algo" de "lo rompimos
// nosotros" — mismo criterio que el resto de los tests de red del repo.
import { describe, expect, it } from "vitest";
import {
  discoverFeeds,
  discoverOnSite,
  searchFeedly,
  feedKey,
  looksLikeSite,
  scoreTopicMatch,
} from "./feed-discovery";

const live = process.env.FEEDS_LIVE === "1";
const strapiFake = {
  documents: () => ({ findMany: async () => [] }),
} as never;

describe.runIf(live)("buscador de fuentes (red)", () => {
  it("Feedly devuelve candidatos para un término amplio", async () => {
    const r = await searchFeedly("seguros", 10);
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].url).toMatch(/^https?:\/\//);
  }, 30000);

  it("autodiscovery encuentra el feed de un medio que no lo declara en el HTML", async () => {
    // ole.com.ar sólo tiene <link rel=alternate hrefLang>, no feeds: si esto
    // devuelve algo, las sondas están haciendo su trabajo.
    const r = await discoverOnSite("ole.com.ar");
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].via).toBe("sonda");
  }, 60000);

  it("una búsqueda por tema devuelve feeds validados y puntuados", async () => {
    const { feeds } = await discoverFeeds(strapiFake, "seguros", { max: 5 });
    expect(feeds.length).toBeGreaterThan(0);
    for (const f of feeds) {
      expect(f.valid).toBe(true);
      expect(f.totalItems).toBeGreaterThan(0);
    }
    // El orden es por porcentaje de match descendente.
    const pcts = feeds.map((f) => f.topicMatch?.pct ?? -1);
    expect([...pcts].sort((a, b) => b - a)).toEqual(pcts);
  }, 120000);
});

describe("helpers (sin red)", () => {
  it("feedKey colapsa la barra final, que es lo que duplicaba resultados", () => {
    expect(feedKey("https://www.perfil.com/feed/")).toBe(feedKey("https://www.perfil.com/feed"));
    expect(feedKey("https://A.com/RSS/")).toBe(feedKey("https://a.com/RSS"));
  });

  it("feedKey NO junta feeds distintos del mismo sitio", () => {
    expect(feedKey("https://x.com/rss/deportes")).not.toBe(feedKey("https://x.com/rss/policiales"));
  });

  it("looksLikeSite distingue un dominio de un tema", () => {
    expect(looksLikeSite("eldiarioar.com")).toBe(true);
    expect(looksLikeSite("https://ole.com.ar/rss/")).toBe(true);
    expect(looksLikeSite("turismo receptivo")).toBe(false);
    expect(looksLikeSite("seguros")).toBe(false);
  });
});

describe("puntaje de tema", () => {
  const item = (title: string) => ({ title, summary: "" });

  it("tolera acentos", () => {
    // Se escribe sin tilde y el titular la lleva: tienen que ser lo mismo.
    expect(scoreTopicMatch([item("Crece la energía solar")], "energia solar")?.pct).toBe(100);
  });

  it("tolera la morfología del español", () => {
    // El caso que lo motivó: un feed cuyo NOMBRE era el tema buscado daba 0 %
    // porque el titular usaba otra flexión de la misma palabra.
    const r = scoreTopicMatch([item("El turista receptivo gastó más")], "turismo receptivo");
    expect(r?.pct).toBe(100);
  });

  it("puntúa por fracción de términos, no por si matchea alguno", () => {
    // Un texto que sólo toca una de las dos palabras vale la mitad.
    const flojo = scoreTopicMatch([item("Un balance receptivo de la temporada")], "turismo receptivo");
    expect(flojo?.pct).toBe(50);
    const pleno = scoreTopicMatch([item("Turismo receptivo: la temporada completa")], "turismo receptivo");
    expect(pleno!.pct).toBeGreaterThan(flojo!.pct);
  });

  it("promedia sobre todos los items, no sobre el primero", () => {
    const r = scoreTopicMatch(
      [item("seguros de vida"), item("recetas de cocina"), item("seguros y salud"), item("clima")],
      "seguros",
    );
    expect(r).toEqual({ matched: 2, total: 4, pct: 50 });
  });

  it("no inventa número cuando la consulta no deja keywords", () => {
    expect(scoreTopicMatch([item("lo que sea")], "de la")).toBeNull();
    expect(scoreTopicMatch([], "seguros")).toBeNull();
  });
});
