import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, Info } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { boletinTitulo, getBoletinPage } from "@/lib/content";
import { formatPostDate } from "@/lib/intl";
import { pageMetadata } from "@/lib/seo";

type Params = Promise<{ lang: string }>;
type Search = Promise<{ page?: string }>;

const PAGE_SIZE = 20;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "normativa" });
  return pageMetadata({
    lang,
    path: "/normativa",
    title: t("title"),
    description: t("tagline"),
  });
}

/** Bloque de la ficha. No se renderiza si la norma no lo dice: un "—" o un
 *  "sin datos" en pantalla se lee como si el dato no existiera en la norma,
 *  cuando lo que pasa es que no lo pudimos afirmar. */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label text-ember">{label}</p>
      <div className="mt-1 font-serif text-[0.9375rem] leading-relaxed">{children}</div>
    </div>
  );
}

export default async function NormativaPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { lang } = await params;
  const { page: pageParam } = await searchParams;
  setRequestLocale(lang);
  const locale = lang as Locale;
  const t = await getTranslations("normativa");

  const page = Math.max(1, Number(pageParam) || 1);
  const { entries, total } = await getBoletinPage(page, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <header className="section-rule mt-10 pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          {t("tagline")}
        </p>
      </header>

      {/* El encuadre va ARRIBA de las fichas, no al pie: quien llega buscando si
          algo lo alcanza tiene que saber qué está leyendo antes de leerlo. */}
      <section className="mt-6 border-y border-rule bg-muted/30 px-5 py-5 sm:px-6">
        <h2 className="label flex items-center gap-2 text-ember">
          <Info className="size-4" aria-hidden />
          {t("disclaimerTitle")}
        </h2>
        <p className="mt-2 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
          {t("disclaimer")}
        </p>
      </section>

      {entries.length === 0 ? (
        <p className="mt-10 font-serif text-lg text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className="label mt-8 text-muted-foreground">{t("total", { count: total })}</p>

          <ul className="mt-4 border-t border-rule">
            {entries.map(entry => {
              const titulo = boletinTitulo(entry);
              return (
              <li key={entry.url} className="border-b border-rule py-7">
                <div className="label flex flex-wrap items-center gap-x-2 text-ember">
                  <span>{entry.rubro ?? "BOLETÍN OFICIAL"}</span>
                  {entry.organismo ? (
                    <>
                      <span aria-hidden className="text-rule">
                        ·
                      </span>
                      <span>{entry.organismo}</span>
                    </>
                  ) : null}
                  {entry.publishedAt ? (
                    <>
                      <span aria-hidden className="text-rule">
                        ·
                      </span>
                      <span>{formatPostDate(entry.publishedAt, locale)}</span>
                    </>
                  ) : null}
                </div>

                {entry.norma ? (
                  <p className="mt-2 font-mono text-base font-semibold">{entry.norma}</p>
                ) : null}
                {titulo ? (
                  <h2 className="mt-1 max-w-4xl font-display text-2xl leading-tight font-semibold">
                    {titulo}
                  </h2>
                ) : null}

                {entry.resumen ? (
                  <p className="mt-3 max-w-3xl font-serif text-base leading-relaxed">
                    {entry.resumen}
                  </p>
                ) : null}

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {entry.queCambia.length > 0 ? (
                    <Campo label={t("queCambia")}>
                      <ul className="space-y-1">
                        {entry.queCambia.map(item => (
                          <li key={item} className="flex gap-2">
                            <span aria-hidden className="text-ember">
                              —
                            </span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </Campo>
                  ) : null}

                  {entry.aQuienAfecta.length > 0 ? (
                    <Campo label={t("aQuienAfecta")}>
                      <div className="flex flex-wrap gap-1.5">
                        {entry.aQuienAfecta.map(quien => (
                          <span
                            key={quien}
                            className="label rounded-full border border-rule px-2.5 py-0.5 text-[0.6875rem]"
                          >
                            {quien}
                          </span>
                        ))}
                      </div>
                    </Campo>
                  ) : null}

                  {entry.vigencia ? (
                    <Campo label={t("vigencia")}>{entry.vigencia}</Campo>
                  ) : null}

                  {entry.pasos.length > 0 ? (
                    <Campo label={t("pasos")}>
                      <ol className="space-y-1">
                        {entry.pasos.map((paso, i) => (
                          <li key={paso} className="flex gap-2">
                            <span aria-hidden className="font-mono text-ember">
                              {i + 1}.
                            </span>
                            <span>{paso}</span>
                          </li>
                        ))}
                      </ol>
                    </Campo>
                  ) : null}

                  {entry.normasCitadas.length > 0 ? (
                    <Campo label={t("normasCitadas")}>
                      <span className="font-mono text-sm text-muted-foreground">
                        {entry.normasCitadas.join(" · ")}
                      </span>
                    </Campo>
                  ) : null}
                </div>

                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="label mt-5 inline-flex items-center gap-1 text-ember hover:underline"
                >
                  {t("source")}
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </a>
              </li>
              );
            })}
          </ul>

          {pages > 1 ? (
            <nav className="mt-8 flex items-center justify-between gap-4">
              {page > 1 ? (
                <Link href={`/normativa?page=${page - 1}`} className="label text-ember hover:underline">
                  ← {t("prev")}
                </Link>
              ) : (
                <span />
              )}
              <span className="label text-muted-foreground">{t("page", { page, pages })}</span>
              {page < pages ? (
                <Link href={`/normativa?page=${page + 1}`} className="label text-ember hover:underline">
                  {t("next")} →
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </main>
  );
}
