import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { NOTAS, anioDe, entrevistasParaHome, rangoViejo } from "@/lib/vertical/archivo";
import { cn } from "@/lib/utils";
import { Firma } from "./Firma";
import { FOCO } from "./foco";
import { PortadaArchivo } from "./PortadaArchivo";

/**
 * «Del archivo», en la portada del sitio: tres entrevistas del archivo
 * histórico —una por entrevistador, la más reciente de cada uno— y el acceso a
 * /archivo. Va en la columna principal, debajo de la ventana de la Copa. Si el
 * manifiesto no trae entrevistas, no se muestra.
 *
 * Cada entrevista tiene su lámina y las tres van en fila, la lámina arriba y la
 * cita abajo, como la sección de entrevistas de /archivo. La fila depende del
 * ancho del bloque y no del de la pantalla (la columna mide distinto según haya
 * riel o no): con menos de 42rem, lista con la lámina chica al costado.
 *
 * Si las tres compartieran la ilustración (antes de importar, cuando cada nota
 * lleva la de su tipo), va una sola al costado de la lista: tres veces el mismo
 * grabado se leía como un error.
 */
export async function ArchivoHome({ className }: { className?: string }) {
  const entrevistas = entrevistasParaHome(NOTAS, 3);
  const rango = rangoViejo(NOTAS);
  if (entrevistas.length === 0 || !rango) return null;
  const t = await getTranslations("archivo");
  const compartida =
    new Set(entrevistas.map(n => n.portada.src)).size === 1 ? entrevistas[0].portada : null;

  const rotulo = (anio: number) => (
    <p className="label text-(--ember-texto)">
      {t("tipo.entrevista")}
      <span aria-hidden> · </span>
      <span className="sr-only">, </span>
      {anio}
    </p>
  );

  return (
    <section aria-labelledby="archivo-home" className={className}>
      <header className="section-rule flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 pt-3">
        <h2 id="archivo-home" className="label text-ink">
          {t("home.titulo")}
        </h2>
        <Link
          href="/archivo"
          className="label inline-flex items-center gap-1.5 text-(--ember-texto) underline-offset-4 hover:underline"
        >
          {t("home.entrar")}
          <ArrowRight className="size-3.5" aria-hidden strokeWidth={1.75} />
        </Link>
      </header>

      {compartida ? (
        <div className="mt-6 grid gap-x-10 gap-y-6 sm:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div>
            <p className="max-w-md font-serif leading-relaxed text-pretty text-muted-foreground">
              {t("home.bajada", rango)}
            </p>
            <PortadaArchivo
              portada={compartida}
              sizes="(min-width: 1024px) 340px, (min-width: 640px) 40vw, 100vw"
              className="mt-6 aspect-video sm:aspect-4/3"
            />
          </div>
          <ol className="border-t border-rule">
            {entrevistas.map(n => (
              <li key={n.slug} className="border-b border-rule">
                <Link href={`/blog/${n.slug}`} className={cn("group block py-5", FOCO)}>
                  {rotulo(anioDe(n.fecha))}
                  <h3 className="mt-2 font-display text-lg leading-snug font-semibold text-pretty group-hover:text-ember sm:text-xl">
                    {n.titulo}
                  </h3>
                  <Firma nota={n} className="mt-3" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        // Contenedor de consultas: arma su propio contexto de apilamiento, y
        // las láminas, que en claro se imprimen sobre el papel (mezcla
        // `darken`), necesitan ver ese papel adentro. Por eso lleva el fondo.
        <div className="@container mt-5 bg-background">
          <p className="max-w-xl font-serif leading-relaxed text-pretty text-muted-foreground">
            {t("home.bajada", rango)}
          </p>
          <ol className="mt-6 grid border-t border-rule @min-[42rem]:grid-cols-3 @min-[42rem]:gap-x-8 @min-[42rem]:border-t-0">
            {entrevistas.map(n => (
              <li
                key={n.slug}
                className="border-b border-rule py-5 @min-[42rem]:border-t @min-[42rem]:border-b-0 @min-[42rem]:pb-0"
              >
                <Link
                  href={`/blog/${n.slug}`}
                  className={cn(
                    "group grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-5 gap-y-4 @min-[30rem]:grid-cols-[10rem_minmax(0,1fr)] @min-[42rem]:grid-cols-1",
                    FOCO,
                  )}
                >
                  <PortadaArchivo
                    portada={n.portada}
                    sizes="(min-width: 768px) 300px, (min-width: 480px) 160px, 112px"
                    className="aspect-4/3 @min-[42rem]:aspect-video"
                  />
                  <div className="min-w-0">
                    {rotulo(anioDe(n.fecha))}
                    <h3 className="mt-2 font-display text-lg leading-snug font-semibold text-pretty group-hover:text-ember">
                      {n.titulo}
                    </h3>
                    <Firma nota={n} className="mt-3" />
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
