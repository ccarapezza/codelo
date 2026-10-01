import { beforeEach, describe, expect, it, vi } from "vitest";
import { NEUTRAL_PROMPT_SETTINGS } from "../prompt-defaults";

// Sólo se reemplaza lo que sale a la red; el resto del módulo queda real.
vi.mock("../openai", async (original) => ({
  ...(await original<typeof import("../openai")>()),
  getOpenAIClient: vi.fn(),
}));
vi.mock("../openai-config", async (original) => ({
  ...(await original<typeof import("../openai-config")>()),
  getOpenAITextKey: () => "clave",
  getOpenAITextModel: async () => "modelo",
}));
vi.mock("../prompt-settings", () => ({ getPromptSettings: async () => NEUTRAL_PROMPT_SETTINGS }));

const openai = await import("../openai");
const { buildClipPrompt, buildOverlayAsk, generateOverlayFields } = await import("./pipeline");

const create = vi.fn();
let respuesta = "{}";

beforeEach(() => {
  respuesta = JSON.stringify({ kicker: "K", title: "T", clip: " C " });
  create.mockReset();
  create.mockImplementation(async () => ({ choices: [{ message: { content: respuesta } }] }));
  vi.mocked(openai.getOpenAIClient).mockReturnValue({ chat: { completions: { create } } } as never);
});

const NOTA = { title: "Título", excerpt: "Resumen", content: "Cuerpo", postDocumentId: "d1", postTitle: "Título" };
const PROMPT_PROPIO = { title: "Un tema", excerpt: "", content: "Un tema", postDocumentId: null, postTitle: null };

/** El pedido que recibió el modelo: la última línea del system prompt. */
const pedido = () => (create.mock.calls[0][0].messages[0].content as string).split("\n").at(-1);

describe("buildOverlayAsk", () => {
  it("sólo textos es, letra por letra, el pedido de antes", () => {
    expect(buildOverlayAsk("title", { textos: true, clip: false })).toBe(
      'Return JSON { "kicker": "<short label, <=22 chars>", "title": "<hook from the article, <=55 chars>" }',
    );
    expect(buildOverlayAsk("countdown", { textos: true, clip: false })).toBe(
      'Return JSON { "label": "<short countdown context, <=55 chars>" }',
    );
  });

  it("con clip suma la clave, en inglés, al final", () => {
    const ask = buildOverlayAsk("title", { textos: true, clip: true });
    expect(ask).toContain('"kicker"');
    expect(ask).toMatch(/"clip": "<one sentence IN ENGLISH/);
    expect(buildOverlayAsk("countdown", { textos: true, clip: true })).toMatch(/"label".*"clip"/);
  });

  it("sólo clip no pide textos", () => {
    const ask = buildOverlayAsk("title", { textos: false, clip: true });
    expect(ask).toMatch(/^Return JSON \{ "clip": /);
    expect(ask).not.toContain("kicker");
  });
});

describe("generateOverlayFields", () => {
  it("nota con el título vacío: textos y clip en una sola llamada", async () => {
    const r = await generateOverlayFields({}, NOTA, "title", {}, true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(pedido()).toContain('"kicker"');
    expect(pedido()).toContain('"clip"');
    // El clip no viaja con los textos: iría a parar al overlay y al recompose.
    expect(r).toEqual({ fields: { kicker: "K", title: "T" }, clip: "C" });
  });

  it("con el título escrito pide sólo el clip y no toca lo que escribió el editor", async () => {
    const r = await generateOverlayFields({}, NOTA, "title", { title: "El mío" }, true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(pedido()).not.toContain("kicker");
    // Ni pisa el título ni le inventa una etiqueta que dejó vacía a propósito.
    expect(r).toEqual({ fields: { title: "El mío" }, clip: "C" });
  });

  it("con el título escrito y sin clip que describir, no llama al modelo", async () => {
    const r = await generateOverlayFields({}, NOTA, "title", { title: "El mío" }, false);
    expect(create).not.toHaveBeenCalled();
    expect(r).toEqual({ fields: { title: "El mío" }, clip: null });
  });

  it("prompt propio: describe el clip, pero los textos siguen sin salir del modelo", async () => {
    const r = await generateOverlayFields({}, PROMPT_PROPIO, "title", {}, true);
    expect(create).toHaveBeenCalledTimes(1);
    expect(pedido()).not.toContain("kicker");
    expect(r).toEqual({ fields: {}, clip: "C" });
  });

  it("prompt propio con un clip ya resuelto: nada que pedir", async () => {
    const r = await generateOverlayFields({}, PROMPT_PROPIO, "title", {}, false);
    expect(create).not.toHaveBeenCalled();
    expect(r).toEqual({ fields: {}, clip: null });
  });

  it("el modelo rellena lo vacío; una etiqueta escrita a mano se respeta", async () => {
    const r = await generateOverlayFields({}, NOTA, "title", { kicker: "La mía" }, false);
    expect(r).toEqual({ fields: { kicker: "La mía", title: "T" }, clip: null });
  });

  it("sin clip en la respuesta, o con una respuesta rota, queda null y cae al clip por defecto", async () => {
    respuesta = JSON.stringify({ kicker: "K", title: "T", clip: "  " });
    expect((await generateOverlayFields({}, NOTA, "title", {}, true)).clip).toBeNull();

    respuesta = "esto no es JSON";
    expect(await generateOverlayFields({}, NOTA, "title", { kicker: "x" }, true)).toEqual({
      fields: { kicker: "x" },
      clip: null,
    });
  });
});

describe("buildClipPrompt", () => {
  const ps = NEUTRAL_PROMPT_SETTINGS;

  it("una descripción, escrita o derivada, va con el estilo de la casa", () => {
    expect(buildClipPrompt(ps, "C")).toBe(`C. ${ps.videoStyle}`);
  });

  it("sin descripción queda el clip por defecto de los ajustes", () => {
    expect(buildClipPrompt(ps)).toBe(`${ps.videoDefaultPrompt}. ${ps.videoStyle}`);
    expect(buildClipPrompt(ps, "   ")).toBe(`${ps.videoDefaultPrompt}. ${ps.videoStyle}`);
  });
});
