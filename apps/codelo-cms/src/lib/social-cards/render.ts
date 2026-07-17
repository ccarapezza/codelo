import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadFonts } from "./fonts";
import type { Size } from "./brand";

// element (árbol satori) + tamaño -> Buffer PNG.
// satori convierte el texto a paths SVG, así que resvg no necesita fuentes.
// `scale` < 1 rasteriza a menor resolución (previews livianos del Studio)
// manteniendo el layout calculado al tamaño real.
export async function renderToPng(element: unknown, size: Size, scale = 1): Promise<Buffer> {
  const svg = await satori(element as never, {
    width: size.width,
    height: size.height,
    fonts: loadFonts() as never,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: Math.round(size.width * scale) } });
  return Buffer.from(resvg.render().asPng());
}
