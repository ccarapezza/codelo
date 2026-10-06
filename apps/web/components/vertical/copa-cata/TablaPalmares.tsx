import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CATEGORIA_ROTULO, fold, getEdicion, type Anio, type Premio } from "@/lib/vertical/copa-cata";
import { cn } from "@/lib/utils";

const enlacePalmares = (q: string) => `/copa-cata/palmares?q=${encodeURIComponent(q)}`;

/**
 * La tabla de premios, en el orden de la fuente (el premio mayor primero).
 *
 * `agrupar`: una cabecera por edición que enlaza a su ficha (palmarés
 * completo). Sin agrupar, una sola edición (la ficha).
 *
 * Categoría normalizada (la misma de los filtros) y premio tal como se
 * publicó. En el teléfono las columnas se funden en tres —premio, ganador,
 * genética con su banco y su muestra— en vez de scrollear: la tabla de 90
 * filas se lee de arriba abajo. Las celdas que se esconden van con `hidden`
 * (display: none), así que un lector de pantalla no las lee dos veces. Un
 * dato que no se sabe deja la celda vacía.
 */
export async function TablaPalmares({
  premios,
  agrupar = false,
  caption,
}: {
  premios: readonly Premio[];
  agrupar?: boolean;
  caption: string;
}) {
  const t = await getTranslations("copa.palmares");
  const grupos: Array<{ anio: Anio; filas: Premio[] }> = [];
  for (const p of premios) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.anio === p.edicion) ultimo.filas.push(p);
    else grupos.push({ anio: p.edicion, filas: [p] });
  }
  const columnas = 6;
  const th = "label py-2 pr-4 text-left align-bottom font-medium text-muted-foreground";
  const td = "py-2.5 pr-4 align-top font-serif text-sm leading-snug";

  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr className="border-b border-rule">
          <th scope="col" className={cn(th, "hidden md:table-cell")}>
            {t("col.categoria")}
          </th>
          <th scope="col" className={th}>
            {t("col.premio")}
          </th>
          <th scope="col" className={th}>
            {t("col.ganador")}
          </th>
          <th scope="col" className={th}>
            {t("col.genetica")}
          </th>
          <th scope="col" className={cn(th, "hidden md:table-cell")}>
            {t("col.banco")}
          </th>
          <th scope="col" className={cn(th, "hidden pr-0 md:table-cell")}>
            {t("col.muestra")}
          </th>
        </tr>
      </thead>
      {grupos.map((g) => {
        const e = getEdicion(g.anio);
        return (
          <tbody key={g.anio}>
            {agrupar ? (
              <tr>
                <th scope="rowgroup" colSpan={columnas} className="pt-8 pb-2 text-left font-normal">
                  <Link
                    href={`/copa-cata/${g.anio}`}
                    className="group inline-flex flex-wrap items-baseline gap-x-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="font-display text-2xl leading-none font-semibold tabular-nums group-hover:underline">
                      {g.anio}
                    </span>
                    <span className="label text-(--ember-texto)">{e.nombre}</span>
                  </Link>
                </th>
              </tr>
            ) : null}
            {g.filas.map((p) => (
              <tr key={p.id} className="border-b border-rule">
                <td className={cn(td, "hidden md:table-cell")}>{CATEGORIA_ROTULO[p.categoria]}</td>
                <td className={td}>
                  {/* En el teléfono la categoría va arriba del premio, salvo
                      que digan lo mismo ("Mención de mesa"). */}
                  {fold(CATEGORIA_ROTULO[p.categoria]) !== fold(p.premioRotulo) ? (
                    <span className="label block text-muted-foreground md:hidden">{CATEGORIA_ROTULO[p.categoria]}</span>
                  ) : null}
                  {p.premioRotulo}
                </td>
                <td className={td}>{p.ganador}</td>
                <td className={td}>
                  {p.genetica ? (
                    <Link
                      href={enlacePalmares(p.genetica)}
                      title={t("filtrarGenetica", { genetica: p.genetica })}
                      className="underline decoration-rule underline-offset-2 hover:text-(--ember-texto) hover:decoration-current"
                    >
                      {p.genetica}
                    </Link>
                  ) : null}
                  {/* En el teléfono, el banco y la muestra van debajo. */}
                  {p.banco || p.muestra ? (
                    <span className="mt-0.5 block font-mono text-[11px] text-muted-foreground md:hidden">
                      {[p.banco, p.muestra ? `n° ${p.muestra}` : null].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td className={cn(td, "hidden md:table-cell")}>{p.banco}</td>
                <td className={cn(td, "hidden pr-0 tabular-nums md:table-cell")}>{p.muestra}</td>
              </tr>
            ))}
          </tbody>
        );
      })}
    </table>
  );
}
