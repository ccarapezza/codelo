import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyProjectSeeds, type ProjectSeed } from "../src/lib/seed-runner";

const UID_PROMPT = "api::prompt-setting.prompt-setting";
const UID_SITE = "api::site-setting.site-setting";

/**
 * Un Strapi de mentira con lo justo: un single type por uid, el core-store y el
 * log. Alcanza para probar las reglas de la semilla sin levantar el servidor.
 */
function fakeStrapi(filas: Record<string, Record<string, unknown> | null> = {}) {
  const store = new Map<string, unknown>();
  const atributos: Record<string, Record<string, unknown>> = {
    [UID_PROMPT]: { brandName: {}, domainDescription: {}, socialVoice: {} },
    [UID_SITE]: { openaiTextModel: {}, autoTranslate: {} },
  };
  const escrituras: Array<{ uid: string; tipo: "update" | "create"; data: Record<string, unknown> }> = [];

  const strapi = {
    contentType: (uid: string) => ({ attributes: atributos[uid] ?? {} }),
    db: {
      query: (uid: string) => ({
        findOne: async () => filas[uid] ?? null,
        update: async ({ data }: { data: Record<string, unknown> }) => {
          escrituras.push({ uid, tipo: "update", data });
          filas[uid] = { ...(filas[uid] ?? {}), ...data };
          return filas[uid];
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          escrituras.push({ uid, tipo: "create", data });
          filas[uid] = { id: 1, ...data };
          return filas[uid];
        },
      }),
    },
    store: () => ({
      get: async ({ key }: { key: string }) => store.get(key),
      set: async ({ key, value }: { key: string; value: unknown }) => void store.set(key, value),
    }),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  };
  return { strapi: strapi as never, store, escrituras, filas };
}

const SEMILLA: ProjectSeed = {
  key: "prompt-settings-1",
  promptSettings: { brandName: "Proyecto", domainDescription: "un portal del sector" },
  siteSettings: { autoTranslate: false },
};

describe("applyProjectSeeds", () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
  });

  it("crea la fila cuando la base está vacía", async () => {
    const f = fakeStrapi();
    await applyProjectSeeds(f.strapi, [SEMILLA]);
    expect(f.escrituras.find((e) => e.uid === UID_PROMPT)).toMatchObject({
      tipo: "create",
      data: { brandName: "Proyecto", domainDescription: "un portal del sector" },
    });
  });

  it("NO pisa lo que ya está cargado: la semilla pone piso, no techo", async () => {
    // El caso real: un proyecto con campos ya editados desde el panel. Si la
    // semilla los pisara, una corrida le borraría el trabajo al editor.
    const f = fakeStrapi({
      [UID_PROMPT]: { id: 1, brandName: "El que ya estaba", domainDescription: "  " },
    });
    await applyProjectSeeds(f.strapi, [SEMILLA]);
    const escritura = f.escrituras.find((e) => e.uid === UID_PROMPT)!;
    expect(escritura.data).toEqual({ domainDescription: "un portal del sector" });
    expect(f.filas[UID_PROMPT]!.brandName).toBe("El que ya estaba");
  });

  it("un false guardado a propósito no cuenta como vacío", async () => {
    const f = fakeStrapi({ [UID_SITE]: { id: 1, autoTranslate: false } });
    await applyProjectSeeds(f.strapi, [{ key: "s", siteSettings: { autoTranslate: true } }]);
    expect(f.escrituras.filter((e) => e.uid === UID_SITE)).toHaveLength(0);
  });

  it("corre una sola vez", async () => {
    const f = fakeStrapi();
    await applyProjectSeeds(f.strapi, [SEMILLA]);
    const despuesDeLaPrimera = f.escrituras.length;
    await applyProjectSeeds(f.strapi, [SEMILLA]);
    expect(f.escrituras).toHaveLength(despuesDeLaPrimera);
  });

  it("avisa de las claves que el schema no tiene, en vez de perderlas en silencio", async () => {
    // Es lo que pasa cuando un proyecto suma un campo propio y se olvida del
    // delta en su schema.json: Strapi lo descarta sin un solo error.
    const f = fakeStrapi();
    await applyProjectSeeds(f.strapi, [
      { key: "s", promptSettings: { brandName: "X", campoInventado: "Y" } },
    ]);
    expect(f.escrituras[0].data).toEqual({ brandName: "X" });
    expect(f.strapi.log.info).toHaveBeenCalledWith(
      expect.stringContaining("IGNORADOS(no están en el schema)=[campoInventado]"),
    );
  });

  it("en producción sin PROJECT_SLUG no toca nada", async () => {
    // Sin slug explícito, la clave del flag puede no ser la de esta base: la
    // semilla se creería pendiente y volvería a correr sobre datos buenos.
    process.env.NODE_ENV = "production";
    const f = fakeStrapi();
    await applyProjectSeeds(f.strapi, [SEMILLA]);
    expect(f.escrituras).toHaveLength(0);
    expect(f.strapi.log.error).toHaveBeenCalledWith(expect.stringContaining("PROJECT_SLUG"));
  });

  it("si falla no bloquea el arranque y deja la semilla pendiente", async () => {
    const f = fakeStrapi();
    f.strapi.db.query = () => {
      throw new Error("base caída");
    };
    await expect(applyProjectSeeds(f.strapi, [SEMILLA])).resolves.toBeUndefined();
    expect(f.store.size).toBe(0);
  });
});
