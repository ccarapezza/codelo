import { describe, expect, it } from "vitest";
import { EDICIONES, esEdicionValida, medioDesdeXml, urlBusqueda } from "./google-news";

describe("urlBusqueda", () => {
  it("arma la edición del país pedido", () => {
    const u = new URL(urlBusqueda("vino", "AR"));
    expect(u.host).toBe("news.google.com");
    expect(u.searchParams.get("gl")).toBe("AR");
    expect(u.searchParams.get("hl")).toBe("es-419");
    expect(u.searchParams.get("ceid")).toBe("AR:es-419");
  });

  // Google News trata el espacio como AND: con cuatro términos deja de traer
  // resultados, y una consulta larga devolvía cero.
  it("une los términos con OR y descarta las palabras cortas", () => {
    const q = new URL(urlBusqueda("vino, bodega y la cosecha", "AR")).searchParams.get("q");
    expect(q).toBe("vino OR bodega OR cosecha");
  });

  it("no manda más de seis términos", () => {
    const q = new URL(urlBusqueda("uno dos tres cuatro cinco seis siete ocho", "ES"))
      .searchParams.get("q")!;
    expect(q.split(" OR ")).toHaveLength(6);
  });

  it("toda edición declarada es válida y única", () => {
    const codes = EDICIONES.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const c of codes) expect(esEdicionValida(c)).toBe(true);
    expect(esEdicionValida("XX")).toBe(false);
    expect(esEdicionValida(null)).toBe(false);
  });
});

describe("medioDesdeXml", () => {
  const xml = `
    <rss><channel>
      <item><source url="https://www.lanacion.com.ar/x">La Nación</source></item>
      <item><source url="https://enolife.com.ar/n">enolife</source></item>
      <item><source url="https://www.lanacion.com.ar/y">La Nación</source></item>
      <item><source url="https://lanacion.com.ar/z">La Nación</source></item>
    </channel></rss>`;

  it("agrupa por host sin www y cuenta los items", () => {
    const m = medioDesdeXml(xml);
    expect(m[0]).toEqual({ host: "lanacion.com.ar", nombre: "La Nación", items: 3 });
    expect(m[1].host).toBe("enolife.com.ar");
  });

  it("ordena por cantidad, que es la señal de relevancia", () => {
    expect(medioDesdeXml(xml).map((x) => x.items)).toEqual([3, 1]);
  });

  it("descarta lo que la guarda de URLs no permite", () => {
    const malo = '<item><source url="http://10.0.0.5/rss">Interno</source></item>';
    expect(medioDesdeXml(malo)).toEqual([]);
  });

  it("limpia el CDATA del nombre", () => {
    const c = '<item><source url="https://medio.com.ar/a"><![CDATA[Medio & Co]]></source></item>';
    expect(medioDesdeXml(c)[0].nombre).toBe("Medio & Co");
  });

  it("no rompe con un xml sin source", () => {
    expect(medioDesdeXml("<rss><channel></channel></rss>")).toEqual([]);
  });
});
