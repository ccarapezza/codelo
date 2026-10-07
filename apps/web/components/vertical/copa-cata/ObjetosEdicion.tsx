import { getTranslations } from "next-intl/server";
import { materialDe, type Grafica, type TipoObjeto } from "@/lib/vertical/copa-cata";
import { Objetos, type ItemObjeto } from "./Objetos";

/**
 * "De mano en mano": las credenciales, entradas, stickers, rótulos, fichas y
 * etiquetas de premio de una edición, como objetos que se mueven (Objetos.tsx).
 * Las gráficas planas de la misma edición van aparte, en su riel.
 */
export async function ObjetosEdicion({ objetos }: { objetos: ReadonlyArray<Grafica & { tipo: TipoObjeto }> }) {
  const t = await getTranslations("copa");
  const items: ItemObjeto[] = objetos.map((g) => {
    const tipo = t(`graficas.${g.tipo}`);
    return {
      src: g.src,
      width: g.width,
      height: g.height,
      alt: g.alt,
      tipo: g.tipo,
      material: materialDe(g),
      rotulo: g.detalle ? `${tipo} · ${g.detalle}` : tipo,
    };
  });
  return (
    <Objetos
      items={items}
      etiquetas={{
        lista: t("secciones.objetos"),
        item: t.raw("galeria.objeto") as string,
        anterior: t("galeria.anterior"),
        siguiente: t("galeria.siguiente"),
        cerrar: t("galeria.cerrar"),
      }}
    />
  );
}
