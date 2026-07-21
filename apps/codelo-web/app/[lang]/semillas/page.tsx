import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, ScanQrCode, Building2, FileText } from "lucide-react";
import { getCultivares, getOperadoresTotal, ultimaSincronizacion } from "@/lib/semillas";
import {
  altasPorAnio,
  cobertura,
  porEspecie,
  porOrigen,
  topObtentores,
} from "@/lib/semillas-stats";
import { localizedAlternates } from "@/lib/seo";
import { CultivaresBrowser } from "./cultivares-browser";
import {
  BarrasHorizontales,
  BarrasSuperpuestas,
  ColumnasPareadas,
  COLOR_RNC,
  COLOR_RNPC,
  Dato,
  Figure,
  Leyenda,
  Tabla,
} from "./charts";
import { CAMPOS_ROTULO, Marcador, RotuloDiagrama } from "./rotulo-diagram";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "seeds" });
  return {
    title: t("title"),
    description: t("tagline"),
    alternates: localizedAlternates(lang, "/semillas"),
  };
}

const INASE_CATALOGO = "https://gestion.inase.gob.ar/registroCultivares/publico/catalogo";

const HERRAMIENTAS = [
  {
    href: "/semillas/leer",
    icono: ScanQrCode,
    titulo: "Leer un rótulo",
    bajada:
      "Escaneá la estampilla o copiá el cultivar y el número de inscripción, y te decimos qué figura en los registros.",
  },
  {
    href: "/semillas/operadores",
    icono: Building2,
    titulo: "Buscar un operador",
    bajada:
      "Consultá si un operador figura en el padrón del RNCyFS. Buscá por razón social, CUIT o número de inscripción, con las categorías traducidas.",
  },
  {
    href: "/semillas/rotulo",
    icono: FileText,
    titulo: "Cómo leer un rótulo",
    bajada:
      "Los campos que el rótulo debe llevar por ley, qué significa cada uno y cuáles podés verificar por tu cuenta.",
  },
] as const;

function formatFecha(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);
}

export default async function SemillasPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("seeds");

  const [cultivares, operadoresTotal] = await Promise.all([getCultivares(), getOperadoresTotal()]);

  const altas = altasPorAnio(cultivares);
  const cob = cobertura(cultivares);
  const especies = porEspecie(cultivares);
  const origen = porOrigen(cultivares);
  const obtentores = topObtentores(cultivares, 7);
  const sincronizado = formatFecha(ultimaSincronizacion(cultivares));

  // The year the story is about: registrations stopped while titles kept
  // flowing. Computed, not hardcoded — if next year is the flat one, the chart
  // follows the data instead of a stale assumption.
  const anioSinAltas =
    altas.find(a => a.rnc === 0 && a.rnpc > 0)?.anio ??
    altas.reduce((min, a) => (a.rnc < min.rnc ? a : min), altas[0])?.anio;

  const hayDatos = cultivares.length > 0;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          {t("tagline")}
        </p>
      </header>

      {/* ---- Panel de cifras ------------------------------------------- */}
      {hayDatos ? (
        <section aria-label="El registro en números" className="mt-2">
          <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:gap-x-10 lg:grid-cols-4">
            <Dato
              destacado
              valor={cultivares.length}
              etiqueta="Cultivares inscriptos"
              nota="Variedades de cannabis y cáñamo en el Catálogo Nacional."
            />
            <Dato
              valor={operadoresTotal?.toLocaleString("es-AR") ?? "—"}
              etiqueta="Operadores en el padrón"
              nota="Empresas y personas inscriptas en el RNCyFS, de todas las especies."
            />
            <Dato
              valor={cob.ambos}
              etiqueta="Con RNC y RNPC"
              nota="Habilitados para la venta y además con título de propiedad."
            />
            <Dato
              valor={origen.nacionales}
              etiqueta="De origen argentino"
              nota={
                origen.importados > 0
                  ? `Los otros ${origen.importados} son importados.`
                  : "Ninguno importado."
              }
            />
          </div>
        </section>
      ) : null}

      {/* ---- Las tres herramientas -------------------------------------- */}
      <section aria-label="Herramientas" className="mt-14">
        <h2 className="section-rule label pt-3 pb-4 text-ink">Qué podés consultar</h2>
        <ul className="grid gap-px bg-rule sm:grid-cols-3">
          {HERRAMIENTAS.map(h => {
            const Icono = h.icono;
            return (
              <li key={h.href} className="bg-background">
                <Link href={h.href} className="group flex h-full flex-col p-5 hover:bg-muted/40">
                  <Icono className="size-6 text-ember" aria-hidden strokeWidth={1.5} />
                  <h3 className="mt-3 font-display text-xl leading-tight font-semibold group-hover:underline">
                    {h.titulo}
                  </h3>
                  <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">
                    {h.bajada}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Anatomía del rótulo ---------------------------------------- */}
      <section aria-label="Anatomía de un rótulo" className="mt-16">
        <h2 className="section-rule label pt-3 pb-4 text-ink">Anatomía de un rótulo</h2>
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div>
            <RotuloDiagrama />
            <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
              Esquema de un paquete de semilla fiscalizada. Los campos son los que exige la
              Resolución INASE 260/2022.
            </p>
          </div>
          <ol className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {CAMPOS_ROTULO.map(c => (
              <li key={c.n} className="flex gap-3">
                <Marcador n={c.n} className="mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-serif text-base leading-snug font-semibold">{c.titulo}</h3>
                  <p className="mt-0.5 font-serif text-sm leading-relaxed text-muted-foreground">
                    {c.detalle}
                  </p>
                  {c.verificable ? (
                    <Link
                      href={c.verificable === "operadores" ? "/semillas/operadores" : "/semillas"}
                      className="label mt-1 inline-block text-ember hover:underline"
                    >
                      Verificable acá
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- El registro en el tiempo ----------------------------------- */}
      {hayDatos ? (
        <section aria-label="El registro en el tiempo" className="mt-16">
          <h2 className="section-rule label pt-3 pb-4 text-ink">El registro en el tiempo</h2>

          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Figure
              titulo="Altas por año: comercialización y propiedad"
              bajada={
                anioSinAltas
                  ? `Las dos inscripciones cuentan lo mismo —cultivares dados de alta— y por eso comparten escala. En ${anioSinAltas} las altas comerciales se frenaron mientras los títulos de propiedad siguieron saliendo.`
                  : "Las dos inscripciones cuentan lo mismo —cultivares dados de alta— y por eso comparten escala."
              }
              tabla={
                <Tabla
                  head={["Año", "RNC", "RNPC"]}
                  rows={altas.map(a => [a.anio, a.rnc, a.rnpc])}
                />
              }
            >
              <div className="mb-3">
                <Leyenda
                  series={[
                    { color: COLOR_RNC, nombre: "RNC — habilita la venta" },
                    { color: COLOR_RNPC, nombre: "RNPC — título de propiedad" },
                  ]}
                />
              </div>
              <ColumnasPareadas datos={altas} destacar={anioSinAltas} />
            </Figure>

            <Figure
              titulo="Qué registro tiene cada cultivar"
              bajada="Un cultivar puede estar en uno, en el otro o en ambos. Se superponen, así que no suman el total."
              tabla={
                <Tabla
                  head={["Grupo", "Cultivares"]}
                  rows={[
                    ["Con RNC", cob.conRnc],
                    ["Con RNPC", cob.conRnpc],
                    ["Con ambos", cob.ambos],
                    ["Solo RNPC", cob.soloRnpc],
                    ["Solo RNC", cob.soloRnc],
                  ]}
                />
              }
            >
              <BarrasSuperpuestas
                total={cob.total}
                series={[
                  {
                    nombre: "Con RNC",
                    valor: cob.conRnc,
                    color: COLOR_RNC,
                    nota: "Habilita la comercialización de la variedad.",
                  },
                  {
                    nombre: "Con RNPC",
                    valor: cob.conRnpc,
                    color: COLOR_RNPC,
                    nota: `Título del obtentor, 20 años. ${cob.soloRnpc} lo tienen sin estar en el RNC.`,
                  },
                ]}
              />
            </Figure>
          </div>
        </section>
      ) : null}

      {/* ---- Quién registra --------------------------------------------- */}
      {hayDatos ? (
        <section aria-label="Quién registra" className="mt-16">
          <h2 className="section-rule label pt-3 pb-4 text-ink">Quién registra</h2>
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
            <Figure
              titulo="Obtentores con más cultivares"
              bajada="Quién registró la genética. No es necesariamente quien fracciona y rotula el paquete."
              tabla={
                <Tabla
                  head={["Obtentor", "Cultivares"]}
                  rows={obtentores.map(o => [o.etiqueta, o.valor])}
                />
              }
            >
              <BarrasHorizontales datos={obtentores} unidad="cultivares" />
            </Figure>

            <Figure
              titulo="Cannabis y cáñamo"
              bajada="Ambos son Cannabis sativa L. La distinción es regulatoria: el cáñamo es la variedad con menos de 1% de THC."
              tabla={
                <Tabla
                  head={["Especie", "Cultivares"]}
                  rows={especies.map(e => [e.etiqueta, e.valor])}
                />
              }
            >
              <BarrasHorizontales datos={especies} unidad="cultivares" />
            </Figure>
          </div>
        </section>
      ) : null}

      {/* ---- Buscador ---------------------------------------------------- */}
      <section aria-label="Buscador de cultivares" className="mt-16">
        <h2 className="section-rule label pt-3 text-ink">{t("cultivaresTitle")}</h2>
        <p className="mt-3 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground">
          {t("cultivaresTagline")}
        </p>

        <CultivaresBrowser
          cultivares={cultivares}
          labels={{
            search: t("searchCultivares"),
            count: t("cultivaresCount"),
            empty: t("cultivaresEmpty"),
            registro: t("registro"),
            obtentor: t("obtentor"),
            altaRnc: t("altaRnc"),
            sinRnc: t("sinRnc"),
            verTodos: t("verTodos"),
            verMenos: t("verMenos"),
          }}
        />
      </section>

      {/* ---- Procedencia -------------------------------------------------
          Va al final y no arriba: es la nota al pie de una fuente, no una
          advertencia que deba interrumpir la lectura. Pero va sí o sí — el
          portal espeja un registro estatal y confundirlo con la fuente
          oficial es el modo más fácil de decidir mal. */}
      <section className="mt-16 border-y border-rule bg-muted/30 px-5 py-5 sm:px-6">
        <h2 className="label text-ember">{t("disclaimerTitle")}</h2>
        <p className="mt-2 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
          {t("disclaimer")}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={INASE_CATALOGO}
            target="_blank"
            rel="noopener noreferrer"
            className="label inline-flex items-center gap-1 text-ember hover:underline"
          >
            {t("officialSource")}
            <ArrowUpRight className="size-3.5" aria-hidden />
          </a>
          {sincronizado ? (
            <p className="label text-muted-foreground">
              {t("syncedAt")} {sincronizado}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
