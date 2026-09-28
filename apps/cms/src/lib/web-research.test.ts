import { describe, expect, it } from "vitest";
import { fuentesDeAnotaciones } from "./web-research";

const conAnotaciones = (anots: unknown[]) => ({
  output: [{ content: [{ text: "apuntes", annotations: anots }] }],
});

describe("fuentesDeAnotaciones", () => {
  it("saca el utm_source que agrega OpenAI a cada cita", () => {
    // Esa URL se publica como fuente de la nota: no tiene por qué llevar
    // el rastreo de quien la buscó.
    const f = fuentesDeAnotaciones(
      conAnotaciones([
        { url: "https://losandes.com.ar/nota?utm_source=openai", title: "Una nota" },
      ]),
    );
    expect(f).toHaveLength(1);
    expect(f[0].url).toBe("https://losandes.com.ar/nota");
    expect(f[0].source).toBe("losandes.com.ar");
    expect(f[0].title).toBe("Una nota");
  });

  it("conserva los demás parámetros de la URL", () => {
    const f = fuentesDeAnotaciones(
      conAnotaciones([{ url: "https://medio.com.ar/n?id=7&utm_source=openai", title: "x" }]),
    );
    expect(f[0].url).toBe("https://medio.com.ar/n?id=7");
  });

  it("deduplica por URL", () => {
    const f = fuentesDeAnotaciones(
      conAnotaciones([
        { url: "https://a.com.ar/1", title: "Una" },
        { url: "https://a.com.ar/1", title: "Una otra vez" },
        { url: "https://b.com.ar/2", title: "Dos" },
      ]),
    );
    expect(f.map((x) => x.url)).toEqual(["https://a.com.ar/1", "https://b.com.ar/2"]);
  });

  it("usa el host cuando la cita no trae título", () => {
    const f = fuentesDeAnotaciones(conAnotaciones([{ url: "https://www.medio.com.ar/n" }]));
    expect(f[0].title).toBe("medio.com.ar");
  });

  it("descarta lo que la guarda de URLs no permite", () => {
    const f = fuentesDeAnotaciones(
      conAnotaciones([
        { url: "http://127.0.0.1/interno", title: "no" },
        { url: "https://valida.com.ar/n", title: "sí" },
      ]),
    );
    expect(f.map((x) => x.url)).toEqual(["https://valida.com.ar/n"]);
  });

  it("no rompe con una respuesta sin anotaciones", () => {
    expect(fuentesDeAnotaciones({ output: [{ content: [{ text: "hola" }] }] })).toEqual([]);
    expect(fuentesDeAnotaciones({})).toEqual([]);
    expect(fuentesDeAnotaciones(null)).toEqual([]);
  });
});
