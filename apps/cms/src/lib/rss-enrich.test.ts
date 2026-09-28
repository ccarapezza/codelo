import { describe, expect, it } from "vitest";
import { descripcionDePagina } from "./rss-fetcher";

describe("descripcionDePagina", () => {
  it("lee og:description, que es lo que el medio escribió para esa nota", () => {
    const html = `<html><head>
      <meta property="og:description" content="A los 91 años falleció Eduardo de Zavalía, expresidente de la Sociedad Rural.">
    </head></html>`;
    expect(descripcionDePagina(html)).toBe(
      "A los 91 años falleció Eduardo de Zavalía, expresidente de la Sociedad Rural.",
    );
  });

  it("acepta los atributos en cualquier orden", () => {
    const html = `<meta content="Una descripción larga y suficientemente informativa del artículo." property="og:description">`;
    expect(descripcionDePagina(html)).toContain("Una descripción larga");
  });

  it("cae a <meta name=description> cuando no hay og", () => {
    const html = `<meta name="description" content="Comparamos el pan, el relleno y el sabor de los triples de jamón y queso.">`;
    expect(descripcionDePagina(html)).toContain("triples de jamón");
  });

  // Vienen escapadas dentro del atributo y sin decodificar llegan crudas al
  // prompt del redactor.
  it("decodifica las entidades del atributo", () => {
    const html = `<meta property="og:description" content="Nuestro país fue sede de un &quot;Mundial carnívoro&quot; y hubo jurados.">`;
    expect(descripcionDePagina(html)).toBe(
      'Nuestro país fue sede de un "Mundial carnívoro" y hubo jurados.',
    );
  });

  it("colapsa los saltos de línea del atributo", () => {
    const html = `<meta property="og:description" content="Primera línea\n   y   segunda, con espacio de sobra en el medio.">`;
    expect(descripcionDePagina(html)).toBe(
      "Primera línea y segunda, con espacio de sobra en el medio.",
    );
  });

  // Una descripción de tres palabras no es evidencia: mejor dejar el ítem como
  // titular suelto que darle al redactor algo que parece un dato y no lo es.
  it("ignora una descripción demasiado corta", () => {
    expect(descripcionDePagina(`<meta property="og:description" content="Noticias">`)).toBe("");
  });

  it("devuelve vacío cuando la página no declara nada", () => {
    expect(descripcionDePagina("<html><body><p>hola</p></body></html>")).toBe("");
  });
});
