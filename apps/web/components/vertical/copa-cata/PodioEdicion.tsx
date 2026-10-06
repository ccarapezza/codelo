import { getTranslations } from "next-intl/server";
import { ArrowRight, Sparkle, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { fold, type Anio, type Premio } from "@/lib/vertical/copa-cata";
import { verPremiosDe } from "@/lib/vertical/copa-cata/textos";

/**
 * El palmarés de una edición: el premio mayor en grande, como el momento de
 * la copa, y el resto compacto, agrupado por categoría en el orden en que se
 * publicó. Solo lo que se sabe: sin genética o sin banco, la línea no aparece.
 */
export async function PodioEdicion({ anio, premios }: { anio: Anio; premios: readonly Premio[] }) {
  const t = await getTranslations("copa");
  const mayor = premios.find((p) => p.categoria === "campeon") ?? premios[0];
  if (!mayor) return null;
  const resto = premios.filter((p) => p !== mayor);

  const grupos: Array<{ rotulo: string; filas: Premio[] }> = [];
  for (const p of resto) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rotulo === p.categoriaRotulo) ultimo.filas.push(p);
    else grupos.push({ rotulo: p.categoriaRotulo, filas: [p] });
  }

  return (
    <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="copa-halo relative self-start overflow-hidden rounded-2xl border border-sun/30 px-6 py-8 sm:px-9 sm:py-10">
        <span className="copa-luz inline-flex size-12 items-center justify-center rounded-full border border-sun/50 text-sun">
          <Trophy className="size-6" aria-hidden strokeWidth={1.5} />
        </span>
        <p className="label mt-6 text-(--ember-texto)">{mayor.premioRotulo}</p>
        <p className="mt-2 font-display text-[clamp(2.25rem,5vw,3.5rem)] leading-[0.95] font-semibold tracking-tight">
          {mayor.ganador}
        </p>
        {mayor.genetica ? (
          <p className="copa-luz mt-4 font-serif text-xl leading-snug text-sun sm:text-2xl">{mayor.genetica}</p>
        ) : null}
        {mayor.banco || mayor.muestra ? (
          <p className="label mt-4 text-muted-foreground">
            {[mayor.banco, mayor.muestra ? `${t("palmares.col.muestra")} ${mayor.muestra}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
      </div>

      {grupos.length > 0 ? (
        <div className="grid content-start gap-x-10 gap-y-8 sm:grid-cols-2">
          {grupos.map((g) => (
            <section key={g.rotulo} aria-label={g.rotulo}>
              <h3 className="label border-b border-rule pb-2 text-muted-foreground">{g.rotulo}</h3>
              <ol className="mt-1">
                {g.filas.map((p) => (
                  <li key={p.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 border-b border-rule/60 py-2.5">
                    <span className="pt-0.5 font-mono text-xs font-medium text-sun tabular-nums">
                      {p.puesto ? `${p.puesto}°` : <Sparkle className="mt-0.5 size-3" aria-hidden strokeWidth={1.75} />}
                    </span>
                    <span className="min-w-0 font-serif text-[0.95rem] leading-snug">
                      {/* El rótulo del premio solo cuando dice algo que el grupo no dice. */}
                      {p.puesto === null && fold(p.premioRotulo) !== fold(g.rotulo) ? (
                        <span className="label mb-0.5 block text-muted-foreground">{p.premioRotulo}</span>
                      ) : null}
                      <span className="text-foreground">{p.ganador}</span>
                      {p.genetica ? <span className="text-muted-foreground"> · {p.genetica}</span> : null}
                      {p.banco ? <span className="label mt-0.5 block text-muted-foreground">{p.banco}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="sm:col-span-2">
            <Link
              href={`/copa-cata/palmares?anio=${anio}`}
              className="label inline-flex items-center gap-1.5 text-(--ember-texto) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {verPremiosDe(anio)}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
