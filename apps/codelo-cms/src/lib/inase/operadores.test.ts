// The fixtures below are byte-faithful to the real export (checked 21/07/2026),
// including its defects: BOM, wrapping quotes, and rows INASE itself damaged.

import { describe, expect, it } from "vitest";
import { parseTsv } from "./operadores";

const HEADER = "numeroInscripcion\trazonSocial\tlocalidad\tprovincia\tcuit\temail";

// The real BOM as it reaches parseTsv: the file's EF BB BF bytes read through a
// latin1 decoder, which is `ï»¿` — not U+FEFF. Writing the fixture with U+FEFF
// (the UTF-8 reading) is what let a real BOM bug through the first time.
const BOM_LATIN1 = "ï»¿";

const SAMPLE = [
  BOM_LATIN1 + HEADER,
  '1FG\t"RIVARA S.A."\tALBERTI\t"BUENOS AIRES"\t30601191640\tmariano.olivero@rivara.com.ar',
  '13481EFK1\t"CS GROUP S. CAP I SECC IV"\tUSHUAIA\t"TIERRA DEL FUEGO"\t30718018850\tinfo@example.com',
  '11238A\t"CANNABIS PATAGONICO S.A."\t"BAHIA BLANCA"\t"BUENOS AIRES"\t30717221857\tx@y.com',
].join("\n");

describe("parseTsv", () => {
  it("reads the rows", () => {
    expect(parseTsv(SAMPLE)).toHaveLength(3);
  });

  it("strips the latin1-decoded BOM so the first column is addressable", () => {
    expect(parseTsv(SAMPLE)[0].numeroInscripcion).toBe("1FG");
  });

  it("also strips a U+FEFF BOM, in case the encoding is ever fixed upstream", () => {
    expect(parseTsv("﻿" + SAMPLE.slice(BOM_LATIN1.length))[0].numeroInscripcion).toBe("1FG");
  });

  it("works with no BOM at all", () => {
    expect(parseTsv(SAMPLE.slice(BOM_LATIN1.length))[0].numeroInscripcion).toBe("1FG");
  });

  it("strips the wrapping quotes", () => {
    expect(parseTsv(SAMPLE)[0].razonSocial).toBe("RIVARA S.A.");
    expect(parseTsv(SAMPLE)[2].localidad).toBe("BAHIA BLANCA");
  });

  it("reads the operator printed on the Tropicana WFC packet", () => {
    expect(parseTsv(SAMPLE)[1]).toMatchObject({
      numeroInscripcion: "13481EFK1",
      razonSocial: "CS GROUP S. CAP I SECC IV",
      provincia: "TIERRA DEL FUEGO",
    });
  });

  it("never surfaces the email column", () => {
    // The export ships ~3.000 addresses in the clear. Republishing them would
    // hand a spam list to anyone who curls our API, for no benefit at all.
    const json = JSON.stringify(parseTsv(SAMPLE));
    expect(json).not.toContain("@");
  });

  it("handles CRLF line endings", () => {
    expect(parseTsv(SAMPLE.replace(/\n/g, "\r\n"))).toHaveLength(3);
  });

  it("skips blank and incomplete lines", () => {
    const withJunk = SAMPLE + "\n\n\t\t\t\t\t\n";
    expect(parseTsv(withJunk)).toHaveLength(3);
  });

  it("returns nothing for an empty file", () => {
    expect(parseTsv("")).toEqual([]);
    expect(parseTsv(HEADER)).toEqual([]);
  });

  it("throws when the columns change, instead of mirroring garbage", () => {
    expect(() => parseTsv("foo\tbar\n1\t2")).toThrow(/columnas esperadas/);
  });
});
