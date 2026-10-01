import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { afterAll, describe, expect, it } from "vitest";
import { bgUriForRender, dataUriFromBuffer, dataUriFromFile } from "./assets";
import { SIZES } from "./brand";
import { loadFonts } from "./fonts";
import { renderSlide } from "./templates";

// Un JPEG de verdad, 16×16 y rojo pleno: bien distinto de cualquier fondo de marca.
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDIooorzD7k/9k=",
  "base64",
);
const WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0]);

const dir = mkdtempSync(join(tmpdir(), "assets-test-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("dataUriFromBuffer", () => {
  it("los bytes mandan sobre el mime que le pasan", () => {
    expect(dataUriFromBuffer(JPEG, "image/png")).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("lo que el detector no conoce se queda con el respaldo", () => {
    expect(dataUriFromBuffer(Buffer.from("<svg xmlns"), "image/svg+xml")).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

describe("dataUriFromFile", () => {
  it("un JPEG guardado como .png sale como JPEG: es el fondo viejo de Medios", () => {
    const ruta = join(dir, "studio-bg-1.png");
    writeFileSync(ruta, JPEG);
    expect(dataUriFromFile(ruta)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("sin firma conocida cae a la extensión", () => {
    const ruta = join(dir, "raro.jpg");
    writeFileSync(ruta, Buffer.from("no soy una imagen"));
    expect(dataUriFromFile(ruta)).toMatch(/^data:image\/jpeg;base64,/);
  });
});

describe("bgUriForRender", () => {
  it("entrega lo que el render sabe dibujar", () => {
    expect(bgUriForRender(JPEG)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("un WEBP no: satori tira con ese mime, y la placa tiene que salir igual", () => {
    expect(bgUriForRender(WEBP)).toBeNull();
  });

  it("lo que no es una imagen tampoco", () => {
    expect(bgUriForRender(Buffer.from("no soy una imagen"))).toBeNull();
  });
});

describe("el fondo se dibuja de verdad", () => {
  // El render en chico alcanza: se mira un pixel de la esquina, donde sólo
  // hay fondo y el velo es más liviano.
  async function pixelDeEsquina(bgUri: string | undefined): Promise<[number, number, number]> {
    const size = SIZES.portrait;
    const nodo = renderSlide({ template: "cover", kicker: "K", title: "Un título", _bgUri: bgUri }, size, {});
    const svg = await satori(nodo as never, { width: size.width, height: size.height, fonts: loadFonts() as never });
    const img = new Resvg(svg, { fitTo: { mode: "width", value: 108 } }).render();
    const i = (2 * img.width + 2) * 4;
    return [img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]];
  }

  it("un fondo JPEG tiñe la placa; etiquetado como PNG no se dibujaba", async () => {
    const [r, g, b] = await pixelDeEsquina(bgUriForRender(JPEG) ?? undefined);
    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);

    // La misma imagen con la etiqueta equivocada: resvg decodifica según el
    // mime y la saltea sin avisar. Es el bug, y por eso el mime sale de los bytes.
    const [r2, g2] = await pixelDeEsquina(`data:image/png;base64,${JPEG.toString("base64")}`);
    expect(r2).toBeLessThan(g2 + 40);
  });
});
