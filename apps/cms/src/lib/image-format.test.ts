import { describe, expect, it } from "vitest";
import { imageFormatFromBytes } from "./image-format";

const bytes = (...b: number[]) => Uint8Array.from(b);
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

describe("imageFormatFromBytes", () => {
  it("reconoce un JPEG", () => {
    expect(imageFormatFromBytes(bytes(0xff, 0xd8, 0xff, 0xdb, 0, 0))).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });

  it("reconoce un PNG", () => {
    expect(imageFormatFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0))).toEqual({
      mime: "image/png",
      ext: "png",
    });
  });

  it("reconoce un GIF", () => {
    expect(imageFormatFromBytes(bytes(...ascii("GIF89a"), 0, 0))).toEqual({ mime: "image/gif", ext: "gif" });
  });

  it("reconoce un WEBP: RIFF, cuatro bytes de tamaño y WEBP", () => {
    expect(imageFormatFromBytes(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WEBP"), 0))).toEqual({
      mime: "image/webp",
      ext: "webp",
    });
  });

  it("un RIFF que no es WEBP (un .wav) no es una imagen", () => {
    expect(imageFormatFromBytes(bytes(...ascii("RIFF"), 1, 2, 3, 4, ...ascii("WAVE")))).toBeNull();
  });

  it("lo que no reconoce es null, sin tirar", () => {
    expect(imageFormatFromBytes(bytes())).toBeNull();
    expect(imageFormatFromBytes(bytes(0xff, 0xd8))).toBeNull();
    expect(imageFormatFromBytes(bytes(...ascii("<svg xmlns")))).toBeNull();
    // Un mp4: los clips pasan por la misma subida y no tienen que confundirse.
    expect(imageFormatFromBytes(bytes(0, 0, 0, 0x20, ...ascii("ftypisom")))).toBeNull();
  });
});
