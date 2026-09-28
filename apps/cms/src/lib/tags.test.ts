import { describe, expect, it, vi } from "vitest";
import { findTagBySlug, getDefaultPostTag } from "./tags";

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
