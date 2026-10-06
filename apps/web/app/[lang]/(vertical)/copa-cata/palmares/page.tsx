import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JsonLd } from "@/components/JsonLd";
import { CopaNav } from "@/components/vertical/copa-cata/CopaNav";
import { Ornamento } from "@/components/vertical/copa-cata/Ornamento";
import { TablaPalmares } from "@/components/vertical/copa-cata/TablaPalmares";
import { TituloSeccion } from "@/components/vertical/copa-cata/TituloSeccion";
import { Link } from "@/i18n/navigation";
import {
  ANIOS_CON_PREMIOS,
  CATEGORIAS,
  CATEGORIA_ROTULO,
  EDICIONES,
  FAMILIAS,
  FAMILIA_ROTULO,
  FAMILIA_DE,
  ORNAMENTOS,
  PREMIOS,
  filtrarPremios,
  filtroDeParams,
  ganadoresRecurrentes,
  geneticasRepetidas,
  matrizCategorias,
  premiosPorCategoria,
  type ParamsPalmares,
} from "@/lib/vertical/copa-cata";
import {
  BAJADA_PALMARES,
  FIGURAS,
  SIN_RESULTADOS,
  cejaPalmares,
  conteoPremios,
} from "@/lib/vertical/copa-cata/textos";
import { breadcrumbSchema, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";
import { cn } from "@/lib/utils";
import {
  BarrasHorizontales,
  COLOR_FAMILIA,
  Figure,
  Leyenda,
  LeyendaMatriz,
  MatrizPresencia,
  Tabla,
} from "../charts";

const PATH = "/copa-cata/palmares";
const desde = ANIOS_CON_PREMIOS[0];
const hasta = ANIOS_CON_PREMIOS[ANIOS_CON_PREMIOS.length - 1];

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "copa" });
  return pageMetadata({
    lang,
    path: PATH,
    title: `${t("palmares.title")} · ${t("title")}`,
    description: BAJADA_PALMARES,
  });
}

const enlaceQ = (q: string) => `${PATH}?q=${encodeURIComponent(q)}`;

/** Lo que la noche necesita de la página: el campo de estrellas del cielo. */
const CIELO = { "--estrellas": `url(${ORNAMENTOS.estrellas.src})` } as React.CSSProperties;

export default async function PalmaresPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<ParamsPalmares>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("copa");

  // Filtro por URL (GET), como /semillas/operadores: compartible, sin JS. El
  // año solo puede ser uno con palmarés; cualquier otro se ignora.
  const filtro = filtroDeParams(await searchParams, ANIOS_CON_PREMIOS);
  const filas = filtrarPremios(PREMIOS, filtro);
  const edicionesFiltradas = new Set(filas.map((p) => p.edicion)).size;

  // Las figuras muestran siempre el total, no el filtro.
  const porCategoria = premiosPorCategoria(PREMIOS);
  const geneticas = geneticasRepetidas(PREMIOS);
  const recurrentes = ganadoresRecurrentes(PREMIOS);
  const matriz = matrizCategorias(
    EDICIONES.filter((e) => ANIOS_CON_PREMIOS.includes(e.anio)),
    PREMIOS,
  );
  const categoriasPresentes = CATEGORIAS.filter((c) => porCategoria.some((p) => p.categoria === c));

  const control =
    "w-full rounded-lg border border-rule bg-card/60 px-3 py-2.5 font-serif text-base text-foreground focus:border-sun focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

  return (
    // -mb-24 anula el mt-24 del pie del sitio: la noche apoya directo sobre la
    // banda de tinta, sin la franja de papel en el medio.
    <main className="copa-noche -mb-24" style={CIELO}>
      <JsonLd
        data={breadcrumbSchema([
          { name: SITE_NAME, url: `${SITE_URL}/${lang}` },
          { name: t("title"), url: `${SITE_URL}/${lang}/copa-cata` },
          { name: t("palmares.title"), url: `${SITE_URL}/${lang}${PATH}` },
        ])}
      />

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        <CopaNav actual="palmares" className="pt-5" />

        <header className="mt-12 sm:mt-16">
          <p className="label text-(--ember-texto)">{cejaPalmares(desde, hasta)}</p>
          <h1 className="copa-luz mt-3 font-display text-[clamp(3rem,8vw,7rem)] leading-[0.9] font-semibold tracking-tight">
            {t("palmares.title")}
          </h1>
          <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            {BAJADA_PALMARES}
          </p>
        </header>

        {/* ---- Filtros ---------------------------------------------------- */}
        <form
          method="get"
          className="mt-12 grid gap-4 rounded-2xl border border-rule p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[10rem_16rem_minmax(0,1fr)_auto] lg:items-end"
        >
          <label className="grid gap-1.5">
            <span className="label text-muted-foreground">{t("palmares.anio")}</span>
            <select name="anio" defaultValue={filtro.anio ?? ""} className={control}>
              <option value="">{t("palmares.todas")}</option>
              {ANIOS_CON_PREMIOS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="label text-muted-foreground">{t("palmares.categoria")}</span>
            <select name="categoria" defaultValue={filtro.categoria ?? ""} className={control}>
              <option value="">{t("palmares.todas")}</option>
              <optgroup label={t("palmares.familias")}>
                {FAMILIAS.map((f) => (
                  <option key={f} value={f}>
                    {FAMILIA_ROTULO[f]}
                  </option>
                ))}
              </optgroup>
              <optgroup label={t("palmares.categorias")}>
                {categoriasPresentes.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_ROTULO[c]}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
            <span className="label text-muted-foreground">{t("palmares.q")}</span>
            <input
              type="search"
              name="q"
              defaultValue={filtro.q}
              placeholder={t("palmares.qPlaceholder")}
              className={cn(control, "placeholder:text-muted-foreground")}
            />
          </label>
          <div className="flex items-center gap-5 sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="copa-brillo label min-h-11 rounded-full bg-sun px-6 text-(--noche) hover:bg-sun/90"
            >
              {t("palmares.filtrar")}
            </button>
            <Link
              href={PATH}
              className="label inline-flex min-h-11 items-center text-(--ember-texto) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {t("palmares.limpiar")}
            </Link>
          </div>
        </form>

        {/* ---- Los premios -------------------------------------------------- */}
        <section aria-labelledby="premios" className="mt-14">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
            <TituloSeccion id="premios">{t("secciones.premios")}</TituloSeccion>
            <p className="label text-muted-foreground tabular-nums">{conteoPremios(filas.length, edicionesFiltradas)}</p>
          </div>
          <div className="mt-4">
            {filas.length > 0 ? (
              <TablaPalmares premios={filas} agrupar caption={`${t("palmares.title")}: ${t("title")}`} />
            ) : (
              <p className="mt-6 max-w-3xl font-serif text-lg leading-relaxed text-muted-foreground">{SIN_RESULTADOS}</p>
            )}
          </div>
        </section>

        {/* ---- El palmarés en cifras ------------------------------------------ */}
        <section aria-labelledby="cifras" className="mt-24 sm:mt-32">
          <TituloSeccion id="cifras">{t("secciones.cifras")}</TituloSeccion>
          <div className="mt-10 grid gap-x-12 gap-y-14 lg:grid-cols-2">
            <Figure
              titulo={FIGURAS.porCategoria.titulo}
              bajada={FIGURAS.porCategoria.bajada}
              tabla={
                <Tabla
                  head={[t("palmares.categoria"), t("palmares.col.premios")]}
                  rows={porCategoria.map((c) => [CATEGORIA_ROTULO[c.categoria], c.premios])}
                />
              }
            >
              <div className="mb-4">
                <Leyenda series={FAMILIAS.map((f) => ({ color: COLOR_FAMILIA[f], nombre: FAMILIA_ROTULO[f] }))} />
              </div>
              <BarrasHorizontales
                unidad="premios"
                datos={porCategoria.map((c) => ({
                  etiqueta: CATEGORIA_ROTULO[c.categoria],
                  valor: c.premios,
                  color: COLOR_FAMILIA[c.familia],
                  grupo: FAMILIA_ROTULO[FAMILIA_DE[c.categoria]],
                  href: `${PATH}?categoria=${c.categoria}`,
                }))}
              />
            </Figure>

            <Figure
              titulo={FIGURAS.matriz.titulo}
              bajada={FIGURAS.matriz.bajada}
              tabla={
                <Tabla
                  nowrap
                  head={[t("palmares.categoria"), ...matriz.anios.map(String)]}
                  rows={matriz.filas.map((f) => [
                    CATEGORIA_ROTULO[f.categoria],
                    ...f.celdas.map((c) => c.premios ?? ""),
                  ])}
                />
              }
            >
              <div className="mb-4">
                <LeyendaMatriz familias={FAMILIA_ROTULO} textos={FIGURAS.matriz} />
              </div>
              <MatrizPresencia
                matriz={matriz}
                rotulos={CATEGORIA_ROTULO}
                familias={FAMILIA_ROTULO}
                textos={FIGURAS.matriz}
                aria={FIGURAS.matriz.titulo}
              />
            </Figure>

            <Figure
              titulo={FIGURAS.geneticas.titulo}
              bajada={FIGURAS.geneticas.bajada}
              tabla={
                <Tabla
                  head={[t("palmares.col.genetica"), t("palmares.col.premios"), t("palmares.col.ediciones")]}
                  rows={geneticas.map((g) => [g.nombre, g.premios, g.ediciones.join(", ")])}
                />
              }
            >
              <BarrasHorizontales
                unidad="premios"
                datos={geneticas.map((g) => ({
                  etiqueta: g.nombre,
                  valor: g.premios,
                  detalle: g.ediciones.join(", "),
                  href: enlaceQ(g.busqueda),
                }))}
              />
            </Figure>

            <Figure
              titulo={FIGURAS.recurrentes.titulo}
              bajada={FIGURAS.recurrentes.bajada}
              tabla={
                <Tabla
                  head={[t("palmares.col.ganador"), t("palmares.col.premios"), t("palmares.col.ediciones")]}
                  rows={recurrentes.map((r) => [r.nombre, r.premios, r.ediciones.join(", ")])}
                />
              }
            >
              <BarrasHorizontales
                unidad="premios"
                datos={recurrentes.map((r) => ({
                  etiqueta: r.nombre,
                  valor: r.premios,
                  detalle: r.ediciones.join(", "),
                  href: enlaceQ(r.busqueda),
                }))}
              />
            </Figure>
          </div>
        </section>
      </div>

      <Ornamento tipo="jardin" className="mx-auto mt-20 max-w-[1400px] sm:mt-28" />
    </main>
  );
}
