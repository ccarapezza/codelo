import { LOGO_FILE } from "../../verticals/brand";
import { imageFormatFromBytes } from "../image-format";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Lo que satori sabe medir. Con cualquier otro mime en una data URI no cae a
// "sin imagen": tira un TypeError y se lleva el render entero.
const RENDERIZABLE = new Set(["image/png", "image/jpeg", "image/gif"]);

// Los assets (fuentes .woff + logo) viven en src/ y NO se copian a dist/ con
// `strapi build`. Resolvemos relativo a la raíz de la app: process.cwd() ===
// apps/cms tanto en `strapi develop` (dev) como en el contenedor
// (WORKDIR /repo/apps/cms), y el runtime Docker copia todo src/.
export function assetPath(...segments: string[]): string {
  return join(process.cwd(), "src/lib/social-cards/assets", ...segments);
}

// El mime de una data URI sale de los BYTES; la extensión y el parámetro son
// el respaldo para lo que el detector no conoce (un SVG). resvg decodifica
// según la etiqueta, no según el contenido: un JPEG etiquetado PNG no se dibuja.
// Leer por bytes es además lo que rescata los fondos que ya quedaron guardados
// con la extensión equivocada.
export function dataUriFromFile(absPath: string): string {
  const buf = readFileSync(absPath);
  const mime = imageFormatFromBytes(buf)?.mime ?? MIME[extname(absPath).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

export function dataUriFromBuffer(buf: Buffer, fallbackMime = "image/png"): string {
  const mime = imageFormatFromBytes(buf)?.mime ?? fallbackMime;
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

/**
 * Un fondo listo para una placa, o `null` si el render no lo puede dibujar.
 *
 * Con `null` la placa sale con el fondo de marca. Quien llama deja el aviso:
 * sin eso, un formato nuevo de un modelo se nota recién en la placa publicada.
 */
export function bgUriForRender(buf: Buffer): string | null {
  const formato = imageFormatFromBytes(buf);
  if (!formato || !RENDERIZABLE.has(formato.mime)) return null;
  return dataUriFromBuffer(buf);
}

// El logo bundleado: el que se usa mientras no haya ninguno subido.
let _logoBundled: string | undefined;
export function bundledLogoMark(): string {
  if (!_logoBundled) _logoBundled = dataUriFromFile(assetPath("logo", LOGO_FILE));
  return _logoBundled;
}

/**
 * El logo subido desde el panel, como data URI, o null si no hay.
 *
 * Los dos proveedores de subida se resuelven distinto y los dos existen en la
 * práctica: el local guarda `/uploads/x.png` y el archivo está bajo `public/`,
 * y uno remoto (S3, Cloudinary) devuelve una URL absoluta que hay que pedir por
 * red. Distinguirlos por la barra inicial es lo que usa el propio Strapi.
 *
 * Falla suave a propósito: si el archivo no está o la descarga no sale, la
 * placa se dibuja con el logo bundleado en vez de tirar la tanda entera.
 */
export async function uploadedLogoMark(
  media: { url?: string; mime?: string } | null | undefined,
): Promise<string | null> {
  const url = media?.url?.trim();
  if (!url) return null;
  try {
    if (url.startsWith("/")) {
      return dataUriFromFile(join(process.cwd(), "public", url));
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return dataUriFromBuffer(buf, media?.mime || "image/png");
  } catch {
    return null;
  }
}
