import { beforeEach, describe, expect, it, vi } from "vitest";

// El runner importa medio motor. Se aíslan la red, la base y —como en el arnés
// de preservación— las costuras de código: en el repo de un proyecto traen lo
// suyo (un runner propio, filtros), y el test tiene que ser el mismo en todos.
vi.mock("./openai", () => ({
  generatePost: vi.fn(),
  getOpenAIClient: vi.fn(() => ({})),
  isOpenRouterModel: () => false,
  findDuplicateSubject: vi.fn(async () => null),
  reviewPost: vi.fn(),
}));
vi.mock("./openai-config", () => ({
  getOpenAITextKey: () => "clave",
  getOpenAITextModel: async () => "modelo",
  getOpenAIDirectorModel: async () => "modelo",
  getOpenAIImageKey: () => "clave",
  getOpenAIImageModel: async () => "imagen",
  getOpenRouterImageKey: () => "clave",
}));
vi.mock("./rss-fetcher", () => ({
  getIngestWindowDays: async () => 7,
  getRecentNewsForTopic: vi.fn(async () => []),
  ingestWindowLabel: (d: number) => `last ${d} days`,
  selectFreePool: (items: unknown[], n: number) => ({ items: items.slice(0, n), fellBack: false }),
}));
vi.mock("./prompt-settings", async () => {
  const { NEUTRAL_PROMPT_SETTINGS } = await import("./prompt-defaults");
  return { getPromptSettings: async () => NEUTRAL_PROMPT_SETTINGS };
});
vi.mock("./audit", () => ({ logAgentAction: vi.fn() }));
vi.mock("./cover-pipeline", () => ({
  CoverPipelineError: class extends Error {},
  findActiveImageGenerator: vi.fn(),
  generateCoverForPost: vi.fn(),
}));
vi.mock("./web-research", () => ({ investigar: vi.fn() }));
vi.mock("./translate-post", () => ({ ensurePostTranslation: vi.fn() }));
vi.mock("../verticals/agent-roles", () => ({ verticalAgentRoles: {} }));
vi.mock("../verticals/director-filters", () => ({ extraDirectorFilters: {} }));

const openai = await import("./openai");
const rss = await import("./rss-fetcher");
const audit = await import("./audit");
const { runRedactor } = await import("./agent-runner");

const generar = vi.mocked(openai.generatePost);
const pool = vi.mocked(rss.getRecentNewsForTopic);
const auditar = vi.mocked(audit.logAgentAction);

/** Un Strapi de mentira: sin notas previas, y guarda lo que se crea. */
function fakeStrapi() {
  const creados: Array<Record<string, unknown>> = [];
  const strapi = {
    documents: () => ({
      findMany: async () => [],
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creados.push(data);
        return { documentId: `doc-${creados.length}`, title: data.title };
      },
    }),
    db: { query: () => ({ findOne: async () => null }) },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
  return { strapi: strapi as never, creados };
}

const agente = (role: string, extra: Record<string, unknown> = {}) =>
  ({
    documentId: `ag-${role}`,
    name: `Agente ${role}`,
    role,
    instructions: "voz propia",
    topic: "cooperativas acopio planta",
    requireNewsContext: true,
    enabled: true,
    schedules: [],
    ...extra,
  }) as never;

const INVESTIGACION = {
  tema: "La ampliación de la planta de acopio",
  apuntes: "- La cooperativa amplió su planta de acopio en marzo (informe anual).",
  fuentes: [
    {
      title: "Informe anual de la cooperativa 2025",
      source: "coop.example.org",
      url: "https://coop.example.org/informe",
      summary: "",
    },
  ],
};

const NOTA = {
  title: "Una planta más grande para el acopio regional",
  excerpt: "Bajada.",
  content: "Cuerpo.",
};

const noticia = (n: number) => ({
  title: `Noticia ${n} sobre la cooperativa`,
  url: `https://example.com/${n}`,
  source: `Medio ${n}`,
  summary: `Resumen de la noticia ${n}.`,
  itemPublishedAt: null,
});

/** El system prompt de la llamada n al redactor. */
const systemDe = (n = 0) => generar.mock.calls[n][2];

beforeEach(() => {
  generar.mockReset();
  pool.mockReset();
  pool.mockResolvedValue([]);
  auditar.mockReset();
});

describe("runRedactor con una investigación (Explorador)", () => {
  it("escribe con las reglas de hechos aunque el RSS no tenga nada de su área", async () => {
    generar.mockResolvedValue(NOTA);
    const f = fakeStrapi();
    await runRedactor(f.strapi, agente("explorador"), 1, undefined, INVESTIGACION);

    // El pool de RSS ni se consulta: la investigación ES el contexto.
    expect(pool).not.toHaveBeenCalled();
    expect(systemDe()).toContain("RESEARCH NOTES");
    expect(systemDe()).toContain("based ONLY on the research notes above");
    expect(systemDe()).not.toContain("no verified news available");
    // Los índices numeran el pool del modo libre; acá no hay pool.
    expect(systemDe()).not.toContain('"sourceIndexes"');
    expect(systemDe()).toContain("as long as the sourced facts allow");
  });

  it("requireNewsContext no tira una investigación ya pagada", async () => {
    generar.mockResolvedValue(NOTA);
    const f = fakeStrapi();
    await runRedactor(f.strapi, agente("explorador", { requireNewsContext: true }), 1, undefined, INVESTIGACION);

    expect(f.creados).toHaveLength(1);
    expect(f.creados[0].sourceContext).toEqual(INVESTIGACION.fuentes);
    expect(f.creados[0].researchNotes).toContain("amplió su planta");
  });

  it("el anti-calco compara contra los titulares de las páginas investigadas", async () => {
    generar
      .mockResolvedValueOnce({ ...NOTA, title: "Informe anual de la cooperativa 2025" })
      .mockResolvedValueOnce(NOTA);
    const f = fakeStrapi();
    await runRedactor(f.strapi, agente("explorador"), 1, undefined, INVESTIGACION);

    expect(generar).toHaveBeenCalledTimes(2);
    expect(generar.mock.calls[1][3]).toContain(
      'nearly copies the source headline "Informe anual de la cooperativa 2025"',
    );
    expect(f.creados[0].title).toBe(NOTA.title);
  });

  it("la auditoría la registra como del Explorador, en modo research", async () => {
    generar.mockResolvedValue(NOTA);
    await runRedactor(fakeStrapi().strapi, agente("explorador"), 1, undefined, INVESTIGACION);

    expect(auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agentRole: "explorador",
        action: "draft_created",
        summary: expect.stringMatching(/^Explorador "Agente explorador" creó/),
        metadata: expect.objectContaining({ mode: "research" }),
      }),
    );
  });
});

describe("runRedactor en modo libre (sin cambios de comportamiento)", () => {
  it("sin noticias y con requireNewsContext, no escribe", async () => {
    const f = fakeStrapi();
    await runRedactor(f.strapi, agente("redactor"), 1);

    expect(pool).toHaveBeenCalled();
    expect(generar).not.toHaveBeenCalled();
    expect(f.creados).toEqual([]);
    expect(auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ agentRole: "redactor", action: "redactor_idle" }),
    );
  });

  it("sin noticias y sin requireNewsContext, escribe en modo análisis con el largo fijo", async () => {
    generar.mockResolvedValue(NOTA);
    await runRedactor(fakeStrapi().strapi, agente("redactor", { requireNewsContext: false }), 1);

    expect(systemDe()).toContain("no verified news available");
    expect(systemDe()).toContain("~600 words");
  });

  it("con noticias, arma el bloque numerado, pide sourceIndexes y guarda la fuente declarada", async () => {
    pool.mockResolvedValue([noticia(1), noticia(2)]);
    generar.mockResolvedValue({ ...NOTA, sourceIndexes: [2] });
    const f = fakeStrapi();
    await runRedactor(f.strapi, agente("redactor"), 1);

    expect(systemDe()).toContain("Verified news context (last 7 days)");
    expect(systemDe()).toContain('"sourceIndexes"');
    expect(f.creados[0].sourceContext).toEqual([
      expect.objectContaining({ url: "https://example.com/2" }),
    ]);
    expect(auditar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        agentRole: "redactor",
        action: "draft_created",
        summary: expect.stringMatching(/^Redactor /),
        metadata: expect.objectContaining({ mode: "free" }),
      }),
    );
  });
});
