// Arma el contexto de render de las placas leyendo la instalación.
//
// Existe para que los tres puntos que renderizan —el carrusel de Social Studio,
// el overlay de los reels y la generación desde una nota— no tengan cada uno su
// propia versión de "de dónde saco los colores". Antes no hacía falta porque la
// marca era una constante importada; ahora vive en la base y hay que leerla.

import { getPromptSettings } from "../prompt-settings";
import { uploadedLogoMark } from "./assets";
import { resolveBrand } from "./brand";
import type { RenderContext } from "./templates";

const UID = "api::site-setting.site-setting";

type StrapiLike = {
  db: {
    query: (uid: string) => {
      findOne: (params: object) => Promise<Record<string, unknown> | null>;
    };
  };
};

/**
 * La marca, el logo y el `@handle` de esta instalación.
 *
 * Falla suave entera: sin fila de ajustes, con la base caída o con un logo que
 * no se puede leer, devuelve lo del motor y la placa sale igual. Una tanda de
 * placas que se cae por un color mal escrito sería peor que una placa con el
 * color por defecto.
 */
export async function getRenderContext(strapi: StrapiLike): Promise<RenderContext> {
  let handle = "";
  try {
    handle = (await getPromptSettings(strapi as never)).socialHandle ?? "";
  } catch {
    // Sin ajustes editoriales: la placa no firma.
  }
  try {
    const row = await strapi.db.query(UID).findOne({ populate: { brandLogo: true } });
    const logo = await uploadedLogoMark(row?.brandLogo as { url?: string; mime?: string } | null);
    return { handle, brand: resolveBrand(row), logo };
  } catch {
    return { handle, brand: resolveBrand(null), logo: null };
  }
}
