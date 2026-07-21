import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, ArrowLeft, Info } from "lucide-react";
import { searchOperadores } from "@/lib/semillas";
import { localizedAlternates } from "@/lib/seo";
import { Categorias } from "../categorias";

type Params = Promise<{ lang: string }>;
type Search = Promise<{ q?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "seeds" });
  return {
    title: t("operadoresTitle"),
    description: t("operadoresTagline"),
    alternates: localizedAlternates(lang, "/semillas/operadores"),
  };
}

const INASE_EMPRESAS = "https://gestion.inase.gob.ar/empresas/empresas";

export default async function OperadoresPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { lang } = await params;
  const { q } = await searchParams;
  setRequestLocale(lang);
  const t = await getTranslations("seeds");

  const query = (q ?? "").trim();
  const results = query.length >= 2 ? await searchOperadores(query) : [];
  const searched = query.length >= 2;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <Link
        href="/semillas"
        className="label mt-6 inline-flex items-center gap-1 text-ember hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("volver")}
      </Link>

      <header className="section-rule mt-4 pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {t("operadoresTitle")}
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          {t("operadoresTagline")}
        </p>
      </header>

      {/* Formulario GET: la búsqueda queda en la URL, así se puede compartir y
          el enlace desde la ficha de un cultivar cae acá ya resuelto. */}
      <form method="get" className="mt-6 flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={t("searchOperadores")}
          aria-label={t("searchOperadores")}
          className="w-full rounded-none border border-rule bg-transparent px-3 py-2.5 font-serif text-base placeholder:text-muted-foreground focus:border-ember focus:outline-none"
        />
        <button
          type="submit"
          className="label border border-ink bg-ink px-4 text-background hover:opacity-90"
        >
          Buscar
        </button>
      </form>

      {!searched ? (
        <p className="mt-8 font-serif text-lg text-muted-foreground">{t("operadoresHint")}</p>
      ) : results.length === 0 ? (
        /* El caso negativo es el más delicado de toda la sección. Que un número
           no figure NO prueba que el operador sea irregular, y decirlo así
           sería difamatorio: puede ser una baja posterior al rotulado, un
           rótulo viejo, un error de lectura, o el desfasaje de 48 h del padrón.
           Por eso el texto describe el hecho —no figura— y nunca lo interpreta. */
        <section className="mt-8 border-y border-rule bg-muted/30 px-5 py-5 sm:px-6">
          <h2 className="label flex items-center gap-2 text-ember">
            <Info className="size-4" aria-hidden />
            {t("notListed")}
          </h2>
          <p className="mt-2 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
            {t("notListedHelp")}
          </p>
          <a
            href={INASE_EMPRESAS}
            target="_blank"
            rel="noopener noreferrer"
            className="label mt-3 inline-flex items-center gap-1 text-ember hover:underline"
          >
            {t("officialSource")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
        </section>
      ) : (
        <ul className="mt-8 border-t border-rule">
          {results.map(o => (
            <li key={o.numeroInscripcion} className="border-b border-rule py-5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-xl leading-tight font-semibold">{o.razonSocial}</h2>
                {!o.vigente ? (
                  <span className="label text-muted-foreground">({t("notListed")})</span>
                ) : null}
              </div>

              <dl className="label mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
                <dt className="sr-only">{t("numeroInscripcion")}</dt>
                <dd className="text-ember">{o.numeroInscripcion}</dd>
                {o.localidad || o.provincia ? (
                  <>
                    <span aria-hidden className="text-rule">
                      ·
                    </span>
                    <dd>{[o.localidad, o.provincia].filter(Boolean).join(", ")}</dd>
                  </>
                ) : null}
                {o.cuit ? (
                  <>
                    <span aria-hidden className="text-rule">
                      ·
                    </span>
                    <dt className="sr-only">{t("cuit")}</dt>
                    <dd className="tabular-nums">{o.cuit}</dd>
                  </>
                ) : null}
              </dl>

              {/* Traducidas con la referencia oficial de INASE. Un código suelto
                  ("EFK1") no le dice nada a nadie; el nombre es lo que responde
                  para qué está habilitado el operador. */}
              {o.categorias?.length ? (
                <div className="mt-4 max-w-3xl">
                  <Categorias
                    codigos={o.categorias}
                    label={t("categorias")}
                    sourceLabel={t("categoriasSource")}
                    help={t("categoriasHelp")}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
