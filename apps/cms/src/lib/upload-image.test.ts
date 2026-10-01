import { describe, expect, it, vi } from "vitest";
import { uploadImageToStrapi } from "./openai";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0, 0, 0, 0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const MP4 = Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

type Subida = {
  data: { fileInfo: { name: string; folder?: number } };
  files: { originalFilename: string; mimetype: string; filepath: string };
};

function fakeStrapi() {
  const upload = vi.fn(async (_opts: unknown) => [{ id: 7 }]);
  const strapi = { plugin: () => ({ service: () => ({ upload }) }) };
  const subida = () => upload.mock.calls[0][0] as Subida;
  return { strapi, subida };
}

describe("uploadImageToStrapi", () => {
  it("un JPEG que llega con nombre y mime de PNG se sube como JPEG", async () => {
    const f = fakeStrapi();
    const id = await uploadImageToStrapi(f.strapi, JPEG, "studio-bg-1.png", "alt", { mime: "image/png", folderId: 3 });
    expect(id).toBe(7);
    // Los dos nombres: Strapi saca la extensión de uno y el nombre visible del otro.
    expect(f.subida().files.originalFilename).toBe("studio-bg-1.jpg");
    expect(f.subida().data.fileInfo.name).toBe("studio-bg-1.jpg");
    expect(f.subida().files.mimetype).toBe("image/jpeg");
    expect(f.subida().files.filepath.endsWith("studio-bg-1.jpg")).toBe(true);
    expect(f.subida().data.fileInfo.folder).toBe(3);
  });

  it("un PNG que llega como .jpg se sube como PNG", async () => {
    const f = fakeStrapi();
    await uploadImageToStrapi(f.strapi, PNG, "cover-d1-1.jpg", "alt");
    expect(f.subida().files.originalFilename).toBe("cover-d1-1.png");
    expect(f.subida().files.mimetype).toBe("image/png");
  });

  it("un nombre sin extensión recibe la del formato", async () => {
    const f = fakeStrapi();
    await uploadImageToStrapi(f.strapi, JPEG, "cover-d1-1", "alt");
    expect(f.subida().files.originalFilename).toBe("cover-d1-1.jpg");
    expect(f.subida().data.fileInfo.name).toBe("cover-d1-1.jpg");
    expect(f.subida().files.mimetype).toBe("image/jpeg");
  });

  it("lo que ya estaba bien no cambia", async () => {
    const f = fakeStrapi();
    await uploadImageToStrapi(f.strapi, PNG, "slide-01-d1-1.png", "alt");
    expect(f.subida().files.originalFilename).toBe("slide-01-d1-1.png");
    expect(f.subida().files.mimetype).toBe("image/png");
  });

  it("un clip mp4 conserva su nombre y el mime que se le pasó", async () => {
    const f = fakeStrapi();
    await uploadImageToStrapi(f.strapi, MP4, "studio-clip-1.mp4", "alt", { mime: "video/mp4" });
    expect(f.subida().files.originalFilename).toBe("studio-clip-1.mp4");
    expect(f.subida().files.mimetype).toBe("video/mp4");
  });
});
