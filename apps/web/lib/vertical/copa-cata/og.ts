// Ilustraciones para las tarjetas de compartir de la Copa (opengraph-image.tsx
// de la portada y de cada edición).
//
// Solo del servidor: lee public/copa-cata/og/<nombre>.jpg y lo devuelve como
// data URI, que es lo que satori sabe embeber (no lee webp: por eso cada
// ilustración tiene su copia en jpg al tamaño exacto de la tarjeta). Son
// derivados de public/copa-cata/ilustraciones/: portada.jpg, 600×315, y
// ilustracion-<anio>.jpg, 252×315. Sin el archivo devuelve `null` y la tarjeta
// se arma sin ilustración.
//
// No se exporta desde index.ts a propósito: importa node:fs y no tiene que
// llegar nunca a un componente de cliente.

import fs from "node:fs/promises";
import path from "node:path";
import type { Anio } from "./tipos";

export async function ilustracionOgDataUri(clave: "portada" | Anio): Promise<string | null> {
  const nombre = clave === "portada" ? "portada" : `ilustracion-${clave}`;
  try {
    const archivo = path.join(process.cwd(), "public", "copa-cata", "og", `${nombre}.jpg`);
    const buf = await fs.readFile(archivo);
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
