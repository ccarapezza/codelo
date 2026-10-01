import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./openai", () => ({
  chooseImagePrompt: vi.fn(),
  generateCoverImage: vi.fn(),
  uploadImageToStrapi: vi.fn(),
  isOpenRouterModel: (m: string) => m.includes("/"),
}));

const openai = await import("./openai");
const { generateCoverForPost, CoverPipelineError } = await import("./cover-pipeline");
import type { PromptSettings } from "./prompt-defaults";

const choose = vi.mocked(openai.chooseImagePrompt);
const generate = vi.mocked(openai.generateCoverImage);
const upload = vi.mocked(openai.uploadImageToStrapi);

const AJUSTES = {
  imageSystemInstructions: "instrucciones del motor",
  imageThemeGuide: "guía",
  imageAnchorTaxonomy: "anclas",
  brandPalette: "dos colores",
} as unknown as PromptSettings;

function fakeStrapi(recientes: string[] = ["una portada anterior"]) {
  const consultas: unknown[] = [];
  const strapi = {
    documents: () => ({
      findMany: async (q: unknown) => {
        consultas.push(q);
        return recientes.map((coverPrompt) => ({ coverPrompt }));
      },
    }),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  return { strapi: strapi as never, consultas, log: strapi.log };
}

const ctx = (extra: Record<string, unknown> = {}) => ({
  textClient: {} as never,
  textModel: "texto",
  imageModel: "google/imagen",
  keys: { openrouterKey: "k" },
  imgAgent: null,
  promptSettings: AJUSTES,
  ...extra,
});

const VACIO = new Error("OpenRouter: no inline image data in response");

beforeEach(() => {
  choose.mockReset();
  generate.mockReset();
  upload.mockReset();
  choose.mockImplementation(async (_c, _m, args) => `prompt para ${args.seedKey}`);
  generate.mockResolvedValue(Buffer.from("png"));
  upload.mockResolvedValue(42);
});

describe("generateCoverForPost", () => {
  it("elige el prompt con la semilla base, genera, sube y devuelve ids y prompt", async () => {
    const f = fakeStrapi();
    const r = await generateCoverForPost(f.strapi, { documentId: "d1", title: "T", excerpt: "E" }, ctx());
    expect(r).toEqual({ coverImageId: 42, coverPrompt: "prompt para d1|T" });
    expect(choose).toHaveBeenCalledTimes(1);
    expect(choose.mock.calls[0][2]).toMatchObject({
      seedKey: "d1|T",
      recentDescriptions: ["una portada anterior"],
      systemInstructions: "instrucciones del motor",
    });
    // El nombre lleva la nota y va SIN extensión: la pone la subida, por bytes.
    expect(upload.mock.calls[0][2]).toMatch(/^cover-d1-\d+$/);
  });

  it("ante el 200 vacío de Gemini reintenta con otra semilla: base, |retry2, |retry3", async () => {
    generate.mockRejectedValueOnce(VACIO).mockRejectedValueOnce(VACIO).mockResolvedValueOnce(Buffer.from("x"));
    const f = fakeStrapi();
    const r = await generateCoverForPost(f.strapi, { documentId: "d1", title: "T", excerpt: null }, ctx());
    expect(choose.mock.calls.map((c) => c[2].seedKey)).toEqual(["d1|T", "d1|T|retry2", "d1|T|retry3"]);
    expect(r.coverPrompt).toBe("prompt para d1|T|retry3");
    expect(f.log.warn).toHaveBeenCalledTimes(2);
  });

  it("otro error no se reintenta: relanza con el prompt y lo deja en el log", async () => {
    generate.mockRejectedValueOnce(new Error("moderation rejected"));
    const f = fakeStrapi();
    const err = await generateCoverForPost(f.strapi, { documentId: "d1", title: "T", excerpt: "" }, ctx()).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(CoverPipelineError);
    expect(err.message).toBe("moderation rejected");
    expect(err.prompt).toBe("prompt para d1|T");
    expect(choose).toHaveBeenCalledTimes(1);
    expect(f.log.error).toHaveBeenCalledWith(expect.stringContaining("prompt was: prompt para d1|T"));
    expect(upload).not.toHaveBeenCalled();
  });

  it("agotados los reintentos, relanza el último vacío", async () => {
    generate.mockRejectedValue(VACIO);
    const f = fakeStrapi();
    const err = await generateCoverForPost(f.strapi, { documentId: "d1", title: "T", excerpt: "" }, ctx()).catch(
      (e) => e,
    );
    expect(err).toBeInstanceOf(CoverPipelineError);
    expect(choose).toHaveBeenCalledTimes(3);
  });

  it("un prompt a mano se usa tal cual, en un solo intento y sin sorteo", async () => {
    generate.mockRejectedValueOnce(VACIO);
    const f = fakeStrapi();
    const err = await generateCoverForPost(
      f.strapi,
      { documentId: null, title: "T", excerpt: "", customPrompt: "  una escena a mano  " },
      ctx(),
    ).catch((e) => e);
    expect(choose).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][2]).toBe("una escena a mano");
    expect(err.prompt).toBe("una escena a mano");
    // Sin sorteo no hace falta la memoria de portadas.
    expect(f.consultas).toEqual([]);
  });

  it("sin nota todavía, el archivo se llama news-cover", async () => {
    const f = fakeStrapi();
    await generateCoverForPost(f.strapi, { documentId: null, title: "T", excerpt: "" }, ctx({ imageModel: "gpt-image-1" }));
    // Tampoco acá decide la extensión el proveedor.
    expect(upload.mock.calls[0][2]).toMatch(/^news-cover-\d+$/);
  });

  it("con las descripciones recientes provistas no consulta la base", async () => {
    const f = fakeStrapi();
    await generateCoverForPost(
      f.strapi,
      { documentId: "d1", title: "T", excerpt: "" },
      ctx({ recentDescriptions: ["dada"] }),
    );
    expect(f.consultas).toEqual([]);
    expect(choose.mock.calls[0][2].recentDescriptions).toEqual(["dada"]);
  });

  it("al regenerar, la portada vieja de la misma nota no cuenta como reciente", async () => {
    const f = fakeStrapi();
    await generateCoverForPost(
      f.strapi,
      { documentId: "d1", title: "T", excerpt: "" },
      ctx({ excludeDocumentId: "d1" }),
    );
    expect(f.consultas[0]).toMatchObject({ filters: { documentId: { $ne: "d1" } } });
  });

  it("el agente de imágenes manda sobre los ajustes: plantilla, tamaño y calidad", async () => {
    const f = fakeStrapi();
    await generateCoverForPost(
      f.strapi,
      { documentId: "d1", title: "T", excerpt: "" },
      ctx({ imgAgent: { imagePromptTemplate: "plantilla propia", imageSize: "1536x1024", imageQuality: "high" } }),
    );
    expect(choose.mock.calls[0][2].systemInstructions).toBe("plantilla propia");
    expect(generate.mock.calls[0][3]).toEqual({ size: "1536x1024", quality: "high" });
  });
});
