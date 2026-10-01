// El formato de una imagen, leído de sus primeros bytes.
//
// Los modelos de imagen no devuelven todos lo mismo —Gemini por OpenRouter
// entrega JPEG, gpt-image PNG— y el motor decidía la extensión y el mime por
// el proveedor. Un JPEG etiquetado PNG se sube y se ve bien en un navegador,
// que mira los bytes, pero resvg decodifica según la etiqueta: la placa salía
// con el fondo de marca, sin la imagen y sin una línea en el log.
//
// Son las mismas firmas que satori usa por dentro (no las exporta). Sin
// dependencias a propósito: lo usan la subida y el render, y ninguno de los dos
// tiene por qué arrastrar al otro.

export type ImageFormat = {
  mime: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  ext: "jpg" | "png" | "gif" | "webp";
};

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function empiezaCon(buf: Uint8Array, firma: number[], desde = 0): boolean {
  if (buf.length < desde + firma.length) return false;
  return firma.every((b, i) => buf[desde + i] === b);
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

/** `null` cuando no es ninguno de los cuatro: el que llama decide el respaldo. */
export function imageFormatFromBytes(buf: Uint8Array): ImageFormat | null {
  if (empiezaCon(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg" };
  if (empiezaCon(buf, PNG)) return { mime: "image/png", ext: "png" };
  if (empiezaCon(buf, ascii("GIF8"))) return { mime: "image/gif", ext: "gif" };
  if (empiezaCon(buf, ascii("RIFF")) && empiezaCon(buf, ascii("WEBP"), 8)) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}
