import { describe, expect, it } from "vitest";
import { stripHtml } from "./rss-fetcher";

describe("stripHtml", () => {
  // El caso que motivó el cambio, copiado de un ítem real de Infocampo
  // (23/09/2026): la `<description>` entera era la miniatura. El redactor veía
  // un titular que prometía un precio y un resumen sin un solo dato, y se
  // inventó "490 dólares".
  it("deja vacío un resumen que es sólo la miniatura", () => {
    const real =
      '<img width="680" height="357" src="https://www.infocampo.com.ar/wp-content/uploads/2025/05/soja-dolar-1024x538.webp" ' +
      'class="webfeedsFeaturedVisual wp-post-image" alt="Precio de la soja" style="display: block;" loading="lazy" />';
    expect(stripHtml(real)).toBe("");
  });

  it("conserva el texto y tira la etiqueta", () => {
    expect(stripHtml("<p>La soja <strong>subió</strong> 3%</p>")).toBe("La soja subió 3%");
  });

  it("no pega palabras de bloques distintos", () => {
    expect(stripHtml("<li>uno</li><li>dos</li>")).toBe("uno dos");
    expect(stripHtml("primera<br>segunda")).toBe("primera segunda");
  });

  it("decodifica entidades DESPUÉS de sacar las etiquetas", () => {
    // Dentro de un CDATA el HTML viene crudo; un `&lt;b&gt;` escapado es texto
    // que el autor quiso mostrar, no una etiqueta que haya que borrar.
    expect(stripHtml("<p>a &amp; b</p>")).toBe("a & b");
    expect(stripHtml("dice &lt;b&gt; literal")).toBe("dice <b> literal");
  });

  it("tira el contenido de script y style, no sólo sus etiquetas", () => {
    expect(stripHtml("<style>.a{color:red}</style>Titular")).toBe("Titular");
    expect(stripHtml("<script>var x = 1;</script>Titular")).toBe("Titular");
  });

  it("colapsa el espacio y recorta", () => {
    expect(stripHtml("  <p>  hola   mundo  </p>  ")).toBe("hola mundo");
  });

  it("deja en paz un resumen que ya venía limpio", () => {
    const limpio = "Las ventas externas crecieron 13% entre enero y agosto.";
    expect(stripHtml(limpio)).toBe(limpio);
  });
});
