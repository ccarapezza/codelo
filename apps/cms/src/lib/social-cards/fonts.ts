import { readFileSync } from "node:fs";
import { assetPath } from "./assets";

export interface LoadedFont {
  name: string;
  data: Buffer;
  weight: number;
  style: "normal" | "italic";
}

const f = (file: string): Buffer => readFileSync(assetPath("fonts", file));

let cache: LoadedFont[] | undefined;
// satori soporta woff (no woff2); usamos los .woff bundleados (de @fontsource).
export function loadFonts(): LoadedFont[] {
  if (cache) return cache;
  cache = [
    { name: "Anton", data: f("anton-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Inter", data: f("inter-latin-400-normal.woff"), weight: 400, style: "normal" },
    { name: "Inter", data: f("inter-latin-600-normal.woff"), weight: 600, style: "normal" },
    { name: "Inter", data: f("inter-latin-700-normal.woff"), weight: 700, style: "normal" },
    { name: "Inter", data: f("inter-latin-800-normal.woff"), weight: 800, style: "normal" },
  ];
  return cache;
}
