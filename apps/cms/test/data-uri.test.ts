// El único camino de descarga de placas del panel. `src/admin/` no entra al
// typecheck, así que esto es lo único que lo ejercita fuera del navegador.

import { describe, expect, it } from "vitest";
import { dataUriToBlob } from "../src/admin/utils/data-uri";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255, 128, 7]);
const uri = (mime: string, bytes: Uint8Array) => `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

describe("dataUriToBlob", () => {
  it("devuelve los mismos bytes, con el tipo de la cabecera", async () => {
    const blob = dataUriToBlob(uri("image/png", PNG));
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(PNG.length);
    // Byte por byte: 0, 255 y 128 son los que una conversión por texto rompe.
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()))).toEqual(Array.from(PNG));
  });

  it("respeta cualquier mime", () => {
    expect(dataUriToBlob(uri("image/jpeg", PNG)).type).toBe("image/jpeg");
  });

  it("lo que no es una data URI en base64 tira, en vez de bajar un archivo roto", () => {
    expect(() => dataUriToBlob("https://example.com/placa.png")).toThrow();
    expect(() => dataUriToBlob("data:image/svg+xml,<svg/>")).toThrow();
    expect(() => dataUriToBlob("sin coma")).toThrow();
  });
});
