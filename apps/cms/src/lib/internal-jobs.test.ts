import { afterEach, describe, expect, it, vi } from "vitest";
import { triggerInternalJob } from "./internal-jobs";

const log = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("triggerInternalJob", () => {
  it("sin URL o sin clave no llama a nada", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const l = log();
    const strapi = { log: l } as never;
    expect(await triggerInternalJob(strapi, { baseUrl: "", apiKey: "k", job: "sync" })).toBe("skipped");
    expect(await triggerInternalJob(strapi, { baseUrl: "http://svc", apiKey: null, job: "sync" })).toBe(
      "skipped",
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(l.warn).toHaveBeenCalledTimes(2);
  });

  it("hace POST a /internal/jobs/<job> con la clave en x-internal-key", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 202, statusText: "Accepted" });
    vi.stubGlobal("fetch", fetch);
    const strapi = { log: log() } as never;
    expect(await triggerInternalJob(strapi, { baseUrl: "http://svc:4000/", apiKey: "k", job: "sync" })).toBe(
      "dispatched",
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("http://svc:4000/internal/jobs/sync");
    expect(init).toMatchObject({ method: "POST", headers: { "x-internal-key": "k" } });
  });

  it("una respuesta de error es failed y queda en el log", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, statusText: "Boom" }));
    const l = log();
    expect(await triggerInternalJob({ log: l } as never, { baseUrl: "http://svc", apiKey: "k", job: "x" })).toBe(
      "failed",
    );
    expect(l.error).toHaveBeenCalledWith(expect.stringContaining("500"));
  });

  it("si fetch lanza, también es failed: nunca tumba el cron", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const l = log();
    expect(await triggerInternalJob({ log: l } as never, { baseUrl: "http://svc", apiKey: "k", job: "x" })).toBe(
      "failed",
    );
    expect(l.error).toHaveBeenCalled();
  });
});
