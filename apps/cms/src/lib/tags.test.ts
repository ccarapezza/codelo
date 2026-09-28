import { describe, expect, it, vi } from "vitest";
import { ensureTagBySlug, findTagBySlug, getDefaultPostTag } from "./tags";

type Tag = { id: number; documentId: string; slug: string };

/** Un Strapi de mentira: tags por slug y una fila de ajustes del sitio. */
function fakeStrapi(tags: Tag[], ajustes: Record<string, unknown> | null) {
  const consultas: string[] = [];
  const strapi = {
    documents: (uid: string) => ({
      findFirst: async ({ filters }: { filters?: { slug?: { $eq?: string } } } = {}) => {
        consultas.push(uid);
        if (uid === "api::site-setting.site-setting") return ajustes;
        return tags.find((t) => t.slug === filters?.slug?.$eq) ?? null;
      },
    }),
    log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  };
  return { strapi: strapi as never, consultas, log: strapi.log };
}

const PORTADA: Tag = { id: 7, documentId: "doc-7", slug: "actualidad" };

describe("findTagBySlug", () => {
  it("encuentra la etiqueta por slug", async () => {
    const f = fakeStrapi([PORTADA], null);
    expect(await findTagBySlug(f.strapi, "actualidad")).toEqual({ id: 7, documentId: "doc-7" });
  });

  it("un slug vacío no consulta la base", async () => {
    const f = fakeStrapi([PORTADA], null);
    expect(await findTagBySlug(f.strapi, "  ")).toBeNull();
    expect(f.consultas).toEqual([]);
  });
});

describe("getDefaultPostTag", () => {
  it("devuelve la etiqueta configurada", async () => {
    const f = fakeStrapi([PORTADA], { defaultPostTagSlug: " actualidad " });
    expect(await getDefaultPostTag(f.strapi)).toEqual({ id: 7, documentId: "doc-7" });
  });

  it("sin slug configurado devuelve null sin buscar ninguna etiqueta", async () => {
    const f = fakeStrapi([PORTADA], { defaultPostTagSlug: "" });
    expect(await getDefaultPostTag(f.strapi)).toBeNull();
    expect(f.consultas).toEqual(["api::site-setting.site-setting"]);
  });

  it("un slug configurado que no existe avisa y devuelve null: no inventa etiquetas", async () => {
    const f = fakeStrapi([PORTADA], { defaultPostTagSlug: "no-existe" });
    expect(await getDefaultPostTag(f.strapi)).toBeNull();
    expect(f.log.warn).toHaveBeenCalledWith(expect.stringContaining('"no-existe" no existe'));
  });

  it("sin fila de ajustes devuelve null", async () => {
    const f = fakeStrapi([PORTADA], null);
    expect(await getDefaultPostTag(f.strapi)).toBeNull();
  });
});

describe("ensureTagBySlug", () => {
  /** Un Strapi que además crea: guarda lo creado para verificarlo. */
  function conAlta(tags: Tag[]) {
    const creadas: Array<Record<string, unknown>> = [];
    let consultas = 0;
    let siguiente = 100;
    const strapi = {
      documents: () => ({
        findFirst: async ({ filters }: { filters?: { slug?: { $eq?: string } } } = {}) => {
          consultas++;
          return tags.find((t) => t.slug === filters?.slug?.$eq) ?? null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          creadas.push(data);
          const t = { id: siguiente, documentId: `doc-${siguiente++}`, slug: String(data.slug) };
          tags.push(t);
          return t;
        },
      }),
      log: { warn: vi.fn() },
    };
    return { strapi: strapi as never, creadas, consultas: () => consultas };
  }

  // Cada test usa slugs propios: el cache es del proceso, a propósito.
  it("devuelve la existente sin crear", async () => {
    const f = conAlta([{ id: 1, documentId: "doc-1", slug: "seccion-a" }]);
    expect(await ensureTagBySlug(f.strapi, { slug: "seccion-a", name: "Sección A" })).toEqual({
      id: 1,
      documentId: "doc-1",
    });
    expect(f.creadas).toEqual([]);
  });

  it("crea la que falta, con el kind pedido (topic por defecto)", async () => {
    const f = conAlta([]);
    await ensureTagBySlug(f.strapi, { slug: "seccion-b", name: "Sección B" });
    await ensureTagBySlug(f.strapi, { slug: "seccion-c", name: "Sección C", kind: "event" });
    expect(f.creadas).toEqual([
      { name: "Sección B", slug: "seccion-b", kind: "topic" },
      { name: "Sección C", slug: "seccion-c", kind: "event" },
    ]);
  });

  it("la segunda vez sale del cache sin consultar, y dos slugs no se pisan", async () => {
    const f = conAlta([
      { id: 5, documentId: "doc-5", slug: "seccion-d" },
      { id: 6, documentId: "doc-6", slug: "seccion-e" },
    ]);
    const d1 = await ensureTagBySlug(f.strapi, { slug: "seccion-d", name: "D" });
    const e1 = await ensureTagBySlug(f.strapi, { slug: "seccion-e", name: "E" });
    const antes = f.consultas();
    const d2 = await ensureTagBySlug(f.strapi, { slug: "seccion-d", name: "D" });
    expect(f.consultas()).toBe(antes);
    expect(d2).toEqual(d1);
    expect(e1).toEqual({ id: 6, documentId: "doc-6" });
  });
});
