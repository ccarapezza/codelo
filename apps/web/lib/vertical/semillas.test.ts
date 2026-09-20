// These tests assert on the URL the fetcher builds, not on responses. The bugs
// worth catching here are query-construction bugs, and they are the quiet kind:
// a wrong filter returns a plausible-looking page of rows instead of an error.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCultivares, searchOperadores } from "./semillas";

const CMS = "http://cms.test";
let requested: string[] = [];

beforeEach(() => {
  requested = [];
  process.env.NEXT_PUBLIC_CMS_URL = CMS;
  vi.stubGlobal("fetch", async (url: string) => {
    requested.push(String(url));
    return {
      ok: true,
      json: async () => ({
        data: [],
        meta: { pagination: { page: 1, pageSize: 100, pageCount: 1, total: 0 } },
      }),
    } as unknown as Response;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Decoded query params of the last request, for readable assertions. */
function lastParams(): URLSearchParams {
  return new URL(requested[requested.length - 1]).searchParams;
}

describe("searchOperadores", () => {
  it("does not add an empty CUIT filter for a text query", async () => {
    // The regression: `$containsi` with an empty value matches every row, so a
    // name search silently returned the entire padrón.
    await searchOperadores("RIVARA");
    const raw = requested[0];
    expect(raw).not.toMatch(/\[cuit\]\[\$containsi\]=(&|$)/);
    expect([...lastParams().entries()].every(([, v]) => v !== "")).toBe(true);
  });

  it("searches the normalized column so accents do not matter", async () => {
    await searchOperadores("peña");
    expect(lastParams().get("filters[$or][0][razonSocialNormalizada][$containsi]")).toBe("PENA");
  });

  it("adds the CUIT filter when the query has enough digits", async () => {
    await searchOperadores("30601191640");
    const values = [...lastParams().entries()].map(([, v]) => v);
    expect(values).toContain("30601191640");
  });

  it("does not treat a short number as a CUIT fragment", async () => {
    await searchOperadores("134");
    const raw = requested[0];
    expect(raw).not.toContain("cuit");
  });

  it("ignores queries shorter than two characters", async () => {
    expect(await searchOperadores("a")).toEqual([]);
    expect(requested).toHaveLength(0);
  });
});

describe("getCultivares", () => {
  it("never asks for more than the CMS page cap", async () => {
    // config/api.ts sets maxLimit: 100 and enforces it SILENTLY — a larger
    // pageSize returns 100 rows with no hint that more exist.
    await getCultivares();
    expect(Number(lastParams().get("pagination[pageSize]"))).toBeLessThanOrEqual(100);
  });

  it("returns an empty list when the CMS URL is unset, instead of throwing", async () => {
    delete process.env.NEXT_PUBLIC_CMS_URL;
    expect(await getCultivares()).toEqual([]);
    expect(requested).toHaveLength(0);
  });
});
