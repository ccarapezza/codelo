import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

// Los assets (fuentes .woff + logo) viven en src/ y NO se copian a dist/ con
// `strapi build`. Resolvemos relativo a la raíz de la app: process.cwd() ===
// apps/fulbo-cms tanto en `strapi develop` (dev) como en el contenedor
// (WORKDIR /repo/apps/fulbo-cms), y el runtime Docker copia todo src/.
export function assetPath(...segments: string[]): string {
  return join(process.cwd(), "src/lib/social-cards/assets", ...segments);
}

export function dataUriFromFile(absPath: string): string {
  const mime = MIME[extname(absPath).toLowerCase()] ?? "image/png";
  return `data:${mime};base64,${readFileSync(absPath).toString("base64")}`;
}

export function dataUriFromBuffer(buf: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${Buffer.from(buf).toString("base64")}`;
}

// Logo con contorno blanco: se lee bien sobre fondo oscuro. Cacheado en memoria.
let _logoMark: string | undefined;
export function logoMark(): string {
  if (!_logoMark) _logoMark = dataUriFromFile(assetPath("logo", "fulbostudio.2.png"));
  return _logoMark;
}
