import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { Firma } from "@/components/vertical/archivo/Firma";
import { FOCO } from "@/components/vertical/archivo/foco";
import { PortadaArchivo } from "@/components/vertical/archivo/PortadaArchivo";
import { Link } from "@/i18n/navigation";
import {
  NOTAS,
  anioDe,
  conteoPorTipo,
  fechaCorta,
  listaDeTipos,
  porAnio,
  rangoViejo,
  tipoDeParam,
  type NotaArchivo,
  type TipoNota,
} from "@/lib/vertical/archivo";
import { breadcrumbSchema, pageMetadata, SITE_LOGO, SITE_NAME, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";

const PATH = "/archivo";
const RANGO = rangoViejo(NOTAS) ?? { desde: 2014, hasta: 2021 };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "archivo" });
  return pageMetadata({ lang, path: PATH, title: t("title"), description: t("seo", RANGO) });
}

export default async function ArchivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("archivo");
  const url = `${SITE_URL}/${lang}${PATH}`;

  // El filtro va por la URL (GET), como el palmarés de la Copa: se comparte y
  // anda sin JS. Solo vale un tipo que tenga notas; cualquier otro, todo.
  const conteo = conteoPorTipo(NOTAS);
  const tipo = tipoDeParam(
    (await searchParams).tipo,
    conteo.map(c => c.tipo),
  );

  const nuevas = NOTAS.filter(n => n.viejoId === null);
  const entrevistas = NOTAS.filter(n => n.destacada && n.tipo === "entrevista");
  // Sin filtro, lo destacado va arriba y abajo queda el resto, año por año. Con
  // filtro, todo lo del tipo, año por año.
  const lista = tipo ? NOTAS.filter(n => n.tipo === tipo) : NOTAS.filter(n => !n.destacada);
  const tiposDeLista = conteoPorTipo(lista).map(c => c.tipo);
  // Cada nota trae su lámina, pero si todas las de la lista compartieran una
  // (las de un tipo sin láminas propias, o antes de importarlas, cuando cada
  // nota lleva la de su tipo), va una sola, en el encabezado, y no una por ficha.
  const laminaUnica =
    lista.length > 1 && new Set(lista.map(n => n.portada.src)).size === 1 ? lista[0].portada : null;
  const rotuloTipo = (x: TipoNota) => t(`tipo.${x}`);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: SITE_NAME, url: `${SITE_URL}/${lang}` },
            { name: t("title"), url },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t("title"),
            description: t("seo", RANGO),
            url,
            inLanguage: lang,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: SITE_LOGO },
            hasPart: NOTAS.map(n => ({
              "@type": "BlogPosting",
              headline: n.titulo,
              url: `${SITE_URL}/${lang}/blog/${n.slug}`,
              datePublished: n.fecha,
              author:
                n.autor === SITE_NAME
                  ? { "@type": "Organization", name: SITE_NAME }
                  : { "@type": "Person", name: n.autor },
            })),
          },
        ]}
      />

      {/* ---- Cabecera: el título, la bajada y el índice por tipo ---------- */}
      <header className="section-rule pt-5">
        <div className="grid gap-x-14 gap-y-5 pb-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
          <div>
            <p className="label text-(--ember-texto)">{t("ceja", RANGO)}</p>
            <h1 className="mt-3 font-display text-[clamp(2.75rem,7.4vw,6.75rem)] leading-[0.9] font-semibold tracking-tight text-balance">
              {t("title")}
            </h1>
          </div>
          <p className="max-w-xl font-serif text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl lg:pb-1.5">
            {t("bajada", RANGO)}
          </p>
        </div>

        {NOTAS.length > 0 ? (
          // Las celdas se acomodan solas en las filas que hagan falta y la última
          // fila crece hasta el borde. Cada una lleva su filete a la izquierda; la
          // lista va corrida un píxel y el nav lo recorta, así la primera de cada
          // fila no dibuja un borde suelto contra el margen.
          <nav aria-label={t("filtro.aria")} className="overflow-hidden border-t border-rule">
            <ul className="-ml-px flex flex-wrap">
              <IndiceTipo
                href={PATH}
                activo={tipo === null}
                cantidad={NOTAS.length}
                rotulo={t("filtro.todo")}
              />
              {conteo.map(c => (
                <IndiceTipo
                  key={c.tipo}
                  href={`${PATH}?tipo=${c.tipo}`}
                  activo={tipo === c.tipo}
                  cantidad={c.cantidad}
                  rotulo={c.cantidad === 1 ? t(`tipo.${c.tipo}`) : t(`tipos.${c.tipo}`)}
                />
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      {NOTAS.length === 0 ? (
        <p className="border-t border-rule py-16 text-center font-serif text-muted-foreground">
          {t("vacio")}
        </p>
      ) : null}

      {/* ---- Nuevo en el archivo ------------------------------------------- */}
      {tipo === null && nuevas.length > 0 ? (
        <section aria-labelledby="nuevas" className="mt-14 sm:mt-20">
          <h2 id="nuevas" className="section-rule label pt-3 pb-7 text-ink">
            {t("nuevas")}
          </h2>
          <ul className={cn("grid gap-x-12 gap-y-14", nuevas.length > 1 && "lg:grid-cols-2")}>
            {nuevas.map((n, i) => (
              <li key={n.slug}>
                <Link
                  href={`/blog/${n.slug}`}
                  className={cn(
                    "group grid gap-6",
                    FOCO,
                    nuevas.length === 1 &&
                      "lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-center lg:gap-12",
                  )}
                >
                  {/* La primera es la imagen grande del primer pliegue en
                      escritorio: se precarga. El resto, perezosa. */}
                  <PortadaArchivo
                    portada={n.portada}
                    sizes="(min-width: 1024px) 640px, 100vw"
                    className="aspect-video"
                    preload={i === 0}
                  />
                  <div>
                    <Rotulo nota={n} tipo={rotuloTipo(n.tipo)} />
                    <h3 className="mt-3 font-display text-[clamp(1.875rem,3.4vw,2.75rem)] leading-[1.02] font-semibold tracking-tight text-balance group-hover:text-ember">
                      {n.titulo}
                    </h3>
                    <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-pretty text-muted-foreground">
                      {n.excerpt}
                    </p>
                    <Firma nota={n} className="mt-5" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---- Entrevistas: cada charla con su lámina, en grilla a todo el ancho.
          En el teléfono, una lista con la lámina chica al costado. ---------- */}
      {tipo === null && entrevistas.length > 0 ? (
        <section aria-labelledby="entrevistas" className="mt-16 sm:mt-24">
          <header className="section-rule grid gap-x-14 gap-y-4 pt-4 pb-8 sm:pb-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-end">
            <h2
              id="entrevistas"
              className="font-display text-[clamp(2.25rem,4.4vw,3.5rem)] leading-none font-semibold tracking-tight"
            >
              {t("entrevistas")}
            </h2>
            <p className="max-w-xl font-serif text-lg leading-relaxed text-pretty text-muted-foreground lg:pb-0.5">
              {t("entrevistasBajada", {
                cantidad: entrevistas.length,
                desde: anioDe(entrevistas[0].fecha),
                hasta: anioDe(entrevistas[entrevistas.length - 1].fecha),
              })}
            </p>
          </header>

          <ol className="grid gap-x-10 sm:grid-cols-2 sm:gap-y-14 lg:grid-cols-3">
            {entrevistas.map(n => (
              <li key={n.slug} className="border-t border-rule py-5 sm:pb-0">
                <Link
                  href={`/blog/${n.slug}`}
                  className={cn(
                    "group grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-5 gap-y-5 sm:grid-cols-1",
                    FOCO,
                  )}
                >
                  <PortadaArchivo
                    portada={n.portada}
                    sizes="(min-width: 1024px) 420px, (min-width: 640px) 46vw, 112px"
                    className="aspect-4/3 sm:aspect-video"
                  />
                  <div className="min-w-0">
                    <p className="label text-(--ember-texto)">
                      <time dateTime={n.fecha}>{fechaCorta(n.fecha)}</time>
                    </p>
                    <h3 className="mt-2 font-display text-lg leading-snug font-semibold text-pretty group-hover:text-ember sm:text-[1.375rem] sm:leading-[1.16]">
                      {n.titulo}
                    </h3>
                    <p className="mt-3 hidden font-serif leading-relaxed text-muted-foreground sm:line-clamp-3">
                      {n.excerpt}
                    </p>
                    <Firma nota={n} className="mt-3 sm:mt-4" />
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* ---- Año por año ------------------------------------------------------ */}
      {lista.length > 0 ? (
        <section aria-labelledby="por-anio" className="mt-16 sm:mt-24">
          <header
            className={cn(
              "section-rule grid gap-x-14 gap-y-5 pt-4 pb-2",
              laminaUnica && "lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:items-end",
            )}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2
                id="por-anio"
                className="font-display text-[clamp(1.75rem,3.2vw,2.5rem)] leading-none font-semibold tracking-tight"
              >
                {listaDeTipos(tiposDeLista, x => t(`tipos.${x}`))}
              </h2>
              <p className="label text-muted-foreground">{t("porAnio")}</p>
            </div>
            {laminaUnica ? (
              <PortadaArchivo
                portada={laminaUnica}
                sizes="(min-width: 1024px) 420px, 100vw"
                className="aspect-video lg:max-w-105"
              />
            ) : null}
          </header>

          {porAnio(lista).map(g => (
            <div
              key={g.anio}
              className="grid gap-x-14 gap-y-5 border-b border-rule py-9 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]"
            >
              <div className="flex items-baseline gap-4 lg:sticky lg:top-24 lg:block lg:self-start">
                <h3 className="font-display text-[clamp(2.75rem,5.4vw,4.75rem)] leading-[0.85] font-semibold tracking-tight text-(--ember-texto) tabular-nums">
                  {g.anio}
                </h3>
                <p className="label text-muted-foreground lg:mt-3">
                  {t("notas", { cantidad: g.notas.length })}
                </p>
              </div>
              <ol className="grid gap-9">
                {g.notas.map(n => (
                  <li key={n.slug}>
                    <Link
                      href={`/blog/${n.slug}`}
                      className={cn(
                        "group grid items-start gap-5 sm:gap-8",
                        FOCO,
                        !laminaUnica &&
                          "grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[12rem_minmax(0,1fr)]",
                      )}
                    >
                      {laminaUnica ? null : (
                        <PortadaArchivo
                          portada={n.portada}
                          sizes="(min-width: 640px) 192px, 104px"
                          className="aspect-4/3"
                        />
                      )}
                      <div className="min-w-0">
                        <Rotulo nota={n} tipo={rotuloTipo(n.tipo)} />
                        <h4 className="mt-2 font-display text-xl leading-tight font-semibold text-pretty group-hover:text-ember sm:text-2xl">
                          {n.titulo}
                        </h4>
                        <p className="mt-2 hidden font-serif leading-relaxed text-muted-foreground sm:line-clamp-2">
                          {n.excerpt}
                        </p>
                        <Firma nota={n} className="mt-3" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      ) : null}
    </main>
  );
}

/** Una celda del índice por tipo: la cifra grande y el rótulo. La activa lleva el filete ámbar. */
function IndiceTipo({
  href,
  activo,
  cantidad,
  rotulo,
}: {
  href: string;
  activo: boolean;
  cantidad: number;
  rotulo: string;
}) {
  return (
    <li className="flex-1 basis-38 border-b border-l border-rule">
      <Link
        href={href}
        scroll={false}
        aria-current={activo ? "page" : undefined}
        className={cn(
          "relative flex h-full flex-col gap-1 px-4 pt-4 pb-3.5 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--ember-texto) sm:px-5",
          "before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-sun before:opacity-0 before:transition-opacity",
          activo
            ? "text-foreground before:opacity-100"
            : "text-muted-foreground hover:text-foreground hover:before:opacity-40",
        )}
      >
        <span className="font-display text-[2rem] leading-none font-semibold tabular-nums">
          {cantidad}
        </span>
        <span className="label">{rotulo}</span>
      </Link>
    </li>
  );
}

/** Tipo y fecha, en la segunda tinta: «Crónica · 05/08/2014». */
function Rotulo({ nota, tipo }: { nota: NotaArchivo; tipo: string }) {
  return (
    <p className="label text-(--ember-texto)">
      {tipo}
      <span aria-hidden> · </span>
      <span className="sr-only">, </span>
      <time dateTime={nota.fecha}>{fechaCorta(nota.fecha)}</time>
    </p>
  );
}
