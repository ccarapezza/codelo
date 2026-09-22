import { describe, expect, it } from "vitest";
import { decodeEntities } from "./rss-fetcher";

describe("decodeEntities", () => {
  it("decodifica las numéricas, que son las que más aparecen en feeds reales", () => {
    // Dos casos vistos en vivo el 21/09/2026 sobre feeds reales: el espacio
    // duro y la comilla tipográfica.
    expect(decodeEntities("Cannabinoid&#160;Supplier")).toBe("Cannabinoid\u00a0Supplier");
    expect(decodeEntities("l&#8217;essai varie d&#8217;un facteur")).toBe("l\u2019essai varie d\u2019un facteur");
  });

  it("decodifica las hexadecimales", () => {
    expect(decodeEntities("caf&#xe9;")).toBe("café");
    expect(decodeEntities("A&#X26;B")).toBe("A&B");
  });

  it("sigue decodificando las nombradas de siempre", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos;")).toBe(
      "a & b <c> \"d\" 'e'",
    );
  });

  it("deja intacta una entidad que no conoce en vez de comérsela", () => {
    expect(decodeEntities("&noexiste; fin")).toBe("&noexiste; fin");
  });

  it("no explota con un código fuera de rango", () => {
    // Un feed ajeno con basura no puede cortar la ingesta entera.
    expect(() => decodeEntities("&#1114112; &#999999999;")).not.toThrow();
  });
});
