import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/admin-auth", () => ({ requireAdmin: vi.fn(async () => true) }));

const { default: crearControlador } = await import("./post-review");

type Fila = { locale: string; publicada: boolean };

/**
 * Un Strapi de mentira: las filas de UN documento por idioma y estado, y un
 * registro de lo que el controlador le pidió al document service. Filtra como
 * el real: `locale: "*"` son todos los idiomas; cualquier otro, sólo ese.
 */
function fakeStrapi(filas: Fila[]) {
  const llamadas: Array<{ op: string; params: Record<string, unknown> }> = [];
  const documentos = {
    findMany: async (params: Record<string, unknown>) => {
      llamadas.push({ op: "findMany", params });
      return filas
        .filter((f) => (params.status === "published" ? f.publicada : !f.publicada))
        .filter((f) => params.locale === "*" || f.locale === params.locale)
        .map((f) => ({ locale: f.locale }));
    },
    unpublish: async (params: Record<string, unknown>) => {
      llamadas.push({ op: "unpublish", params });
    },
    delete: async (params: Record<string, unknown>) => {
      llamadas.push({ op: "delete", params });
    },
  };
  return { strapi: { documents: () => documentos }, llamadas };
}

function ctx(body: Record<string, unknown>) {
  const c: Record<string, any> = { request: { body }, body: undefined, status: 200 };
  c.badRequest = vi.fn((mensaje: string) => {
    c.status = 400;
    c.body = { error: mensaje };
    return c;
  });
  return c;
}

describe("despublicar desde Notas", () => {
  it("baja la nota en todos sus idiomas, no sólo en el por defecto", async () => {
    const f = fakeStrapi([
      { locale: "es", publicada: true },
      { locale: "en", publicada: true },
    ]);
    const c = ctx({ documentId: "doc-1" });
    await crearControlador({ strapi: f.strapi }).unpublish(c);

    expect(f.llamadas).toEqual([{ op: "unpublish", params: { documentId: "doc-1", locale: "*" } }]);
    expect(c.body).toEqual({ ok: true });
  });
});

describe("borrar desde Notas", () => {
  it("sin ninguna versión publicada, borra todos los idiomas", async () => {
    const f = fakeStrapi([
      { locale: "es", publicada: false },
      { locale: "en", publicada: false },
    ]);
    const c = ctx({ documentId: "doc-1" });
    await crearControlador({ strapi: f.strapi }).remove(c);

    expect(f.llamadas.at(-1)).toEqual({ op: "delete", params: { documentId: "doc-1", locale: "*" } });
    expect(c.body).toEqual({ ok: true });
  });

  it("si la traducción sigue publicada, no borra aunque el idioma por defecto sea borrador", async () => {
    const f = fakeStrapi([
      { locale: "es", publicada: false },
      { locale: "en", publicada: true },
    ]);
    const c = ctx({ documentId: "doc-1" });
    await crearControlador({ strapi: f.strapi }).remove(c);

    expect(c.status).toBe(400);
    expect(f.llamadas.some((l) => l.op === "delete")).toBe(false);
  });

  it("si el idioma por defecto está publicado, no borra", async () => {
    const f = fakeStrapi([{ locale: "es", publicada: true }]);
    const c = ctx({ documentId: "doc-1" });
    await crearControlador({ strapi: f.strapi }).remove(c);

    expect(c.status).toBe(400);
    expect(f.llamadas.some((l) => l.op === "delete")).toBe(false);
  });

  it("sin documentId responde 400 sin tocar nada", async () => {
    const f = fakeStrapi([]);
    const c = ctx({});
    await crearControlador({ strapi: f.strapi }).remove(c);

    expect(c.status).toBe(400);
    expect(f.llamadas).toEqual([]);
  });
});
