import { getTranslations } from "next-intl/server";
import type { Grafica } from "@/lib/vertical/copa-cata";
import { Galeria, type ItemGaleria } from "./Galeria";

/**
 * Afiches, flyers, logos y placas de una edición, versionados en
 * public/copa-cata/, en un riel que abre el mismo visor que las fotos.
 */
export async function GraficasEdicion({ graficas }: { graficas: readonly Grafica[] }) {
  const t = await getTranslations("copa");
  const items: ItemGaleria[] = graficas.map((g) => ({
    src: g.src,
    miniatura: g.src,
    width: g.width,
    height: g.height,
    alt: g.alt,
    rotulo: t(`graficas.${g.tipo}`),
  }));
  return (
    <Galeria
      items={items}
      variante="riel"
      etiquetas={{
        lista: t("secciones.graficas"),
        item: t.raw("galeria.grafica") as string,
        anterior: t("galeria.anterior"),
        siguiente: t("galeria.siguiente"),
        cerrar: t("galeria.cerrar"),
        rielAnterior: t("riel.anterior"),
        rielSiguiente: t("riel.siguiente"),
      }}
    />
  );
}
