import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Leaf, Sprout, Trophy } from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { CopaNav } from "@/components/vertical/copa-cata/CopaNav";
import { ObjetoEnlace } from "@/components/vertical/copa-cata/Objetos";
import { Ornamento } from "@/components/vertical/copa-cata/Ornamento";
import { RielEdiciones } from "@/components/vertical/copa-cata/RielEdiciones";
import { TituloSeccion } from "@/components/vertical/copa-cata/TituloSeccion";
import { Link } from "@/i18n/navigation";
import {
  EDICIONES,
  ILUSTRACION_PORTADA,
  ORNAMENTOS,
  PREMIOS,
  enNumeros,
  materialDe,
  objetosDe,
  records,
  type Recurrencia,
} from "@/lib/vertical/copa-cata";
import {
  NUMEROS,
  RECORDS,
  bajadaPortada,
  cejaPortada,
  manifiesto,
  palmaresCta,
  premiosEnAnios,
  premiosEnCopas,
  rotuloCredencialPortada,
  seoPortada,
} from "@/lib/vertical/copa-cata/textos";
import { breadcrumbSchema, localizedAlternates, OG_LOCALE, SITE_LOGO, SITE_NAME, SITE_URL } from "@/lib/seo";

const PATH = "/copa-cata";
const numeros = enNumeros(EDICIONES, PREMIOS);
const seo = seoPortada(numeros.ediciones, numeros.desde, numeros.hasta);

/**
 * Metadata armada a mano y no con pageMetadata(): aquella fija la tarjeta por
 * defecto del sitio en `openGraph.images`, y con `images` declarado Next no
 * usa la opengraph-image.tsx de esta ruta. Mismo criterio que [anio].
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: seo.title,
    description: seo.description,
    alternates: localizedAlternates(lang, PATH),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang] ?? OG_LOCALE.es,
      url: `/${lang}${PATH}`,
      title: seo.title,
      description: seo.description,
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description },
  };
}

/** Lo que la noche necesita de la página: el campo de estrellas del cielo. */
const CIELO = { "--estrellas": `url(${ORNAMENTOS.estrellas.src})` } as React.CSSProperties;

export default async function CopaCataPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("copa");
  const url = `${SITE_URL}/${lang}${PATH}`;
  const [parrafo1, parrafo2] = manifiesto(EDICIONES[0]);
  // La primera credencial de la primera Copa, si la hay: cuelga junto al
  // manifiesto ("nació en 2014 como una cata entre socios") y entra a su edición.
  const credencial = objetosDe(EDICIONES[0].anio).find((g) => g.tipo === "credencial") ?? null;
  const r = records(PREMIOS);

  return (
    // -mb-24 anula el mt-24 del pie del sitio: la noche apoya directo sobre la
    // banda de tinta, sin la franja de papel en el medio.
    <main className="copa-noche -mb-24" style={CIELO}>
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
            description: seo.description,
            url,
            inLanguage: lang,
            isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
            publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: SITE_LOGO },
            hasPart: EDICIONES.map((e) => ({
              "@type": "Article",
              headline: `${e.nombre} (${e.anio})`,
              url: `${url}/${e.anio}`,
            })),
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-5 pt-5 sm:px-8">
        <CopaNav actual="inicio" />
      </div>

      {/* ---- Portada a sangre ------------------------------------------------
          La ilustración ocupa todo el ancho y se funde abajo con la noche; el
          título se apoya sobre ese fundido, donde la imagen ya casi no está.
          En el teléfono va debajo: ahí la imagen es baja y el fundido, corto,
          y la ceja sobre él bajaba de 4,5:1. */}
      <header className="relative">
        <div className="copa-arte copa-fundido-abajo relative mx-auto mt-2 h-[min(56.25vw,64vh)] max-w-[1920px] overflow-hidden">
          <div className="copa-flota absolute inset-0">
            <Image
              src={ILUSTRACION_PORTADA.src}
              alt={ILUSTRACION_PORTADA.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          </div>
        </div>
        <div className="relative mx-auto max-w-[1400px] px-5 sm:-mt-[clamp(1.5rem,5vw,4.5rem)] sm:px-8">
          <p className="label text-(--ember-texto)">
            {cejaPortada(numeros.ediciones, numeros.desde, numeros.hasta)}
          </p>
          <h1 className="mt-3 font-display text-[clamp(3rem,8.6vw,8.25rem)] leading-[0.9] font-semibold tracking-tight text-balance">
            {t("title")}
          </h1>
          <p className="mt-6 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground sm:text-xl">
            {bajadaPortada(numeros.ediciones)}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* ---- Manifiesto -------------------------------------------------- */}
        <section
          aria-labelledby="manifiesto"
          className="mt-20 grid gap-6 sm:mt-28 lg:grid-cols-[minmax(0,3fr)_minmax(0,9fr)] lg:gap-12"
        >
          <div>
            <h2 id="manifiesto" className="label pt-2 text-(--ember-texto)">
              {t("secciones.manifiesto")}
            </h2>
            {credencial ? (
              <ObjetoEnlace
                item={{
                  src: credencial.src,
                  width: credencial.width,
                  height: credencial.height,
                  alt: credencial.alt,
                  tipo: credencial.tipo,
                  material: materialDe(credencial),
                  rotulo: rotuloCredencialPortada(EDICIONES[0]),
                }}
                href={`/copa-cata/${EDICIONES[0].anio}`}
                tamanio="176px"
                className="mt-28 ml-4 hidden w-[11rem] lg:block"
              />
            ) : null}
          </div>
          <div className="max-w-4xl">
            <p className="font-serif text-[clamp(1.375rem,2.6vw,2.125rem)] leading-snug text-pretty">{parrafo1}</p>
            <p className="mt-6 font-serif text-[clamp(1.125rem,1.8vw,1.5rem)] leading-relaxed text-pretty text-muted-foreground">
              {parrafo2}
            </p>
          </div>
        </section>
      </div>

      <Ornamento tipo="orbitas" className="mx-auto mt-14 max-w-[1100px] sm:mt-20" />

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* ---- En números -------------------------------------------------- */}
        <section aria-labelledby="en-numeros" className="mt-6 sm:mt-10">
          <TituloSeccion id="en-numeros">{t("secciones.enNumeros")}</TituloSeccion>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
            <Numero valor={numeros.ediciones} etiqueta={NUMEROS.copas} />
            <Numero valor={numeros.premios} etiqueta={NUMEROS.premios} />
            <Numero valor={numeros.geneticas} etiqueta={NUMEROS.geneticas} />
            <Numero valor={numeros.ganadores} etiqueta={NUMEROS.ganadores} />
            <Numero valor={numeros.marcas.max} antes={NUMEROS.marcasAntes} etiqueta={NUMEROS.marcas} />
          </dl>
        </section>
      </div>

      {/* ---- Las ediciones: un riel que corre hasta el borde --------------- */}
      <section aria-labelledby="ediciones" className="mt-24 sm:mt-32">
        <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
          <TituloSeccion id="ediciones">{t("secciones.ediciones")}</TituloSeccion>
        </div>
        <div className="mx-auto mt-6 max-w-[1400px] [--riel-margen:0.75rem] sm:[--riel-margen:1.5rem]">
          <RielEdiciones />
        </div>
      </section>

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* ---- Récords ------------------------------------------------------ */}
        <section aria-labelledby="records" className="mt-24 sm:mt-32">
          <TituloSeccion id="records">{t("secciones.records")}</TituloSeccion>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            <Record
              icono={<Trophy className="size-5" aria-hidden strokeWidth={1.5} />}
              rotulo={RECORDS.ganador}
              lista={r.ganador}
              detalle={(x) => premiosEnCopas(x.premios, x.ediciones.length)}
            />
            <Record
              icono={<Leaf className="size-5" aria-hidden strokeWidth={1.5} />}
              rotulo={RECORDS.genetica}
              lista={r.genetica}
              detalle={(x) => premiosEnAnios(x.premios, x.ediciones)}
            />
            <Record
              icono={<Sprout className="size-5" aria-hidden strokeWidth={1.5} />}
              rotulo={RECORDS.banco}
              lista={r.banco}
              detalle={(x) => premiosEnAnios(x.premios, x.ediciones)}
            />
          </ul>
        </section>

        {/* ---- Al palmarés -------------------------------------------------- */}
        <section aria-label={t("palmares.title")} className="mt-16 sm:mt-24">
          <Link
            href="/copa-cata/palmares"
            className="copa-brillo copa-halo group flex flex-col gap-6 rounded-2xl border border-sun/30 px-6 py-8 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:py-12"
          >
            <span>
              <span className="label block text-(--ember-texto)">{t("nav.palmares")}</span>
              <span className="mt-3 block font-display text-[clamp(1.875rem,4.4vw,3.5rem)] leading-[0.95] font-semibold tracking-tight">
                {t("palmares.cta")}
              </span>
              <span className="mt-4 block max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
                {palmaresCta(numeros.premios)}
              </span>
            </span>
            <span className="inline-flex size-14 shrink-0 items-center justify-center self-end rounded-full border border-sun/50 text-sun transition-colors group-hover:bg-sun/12 sm:self-auto">
              <ArrowRight className="size-6" aria-hidden strokeWidth={1.5} />
            </span>
          </Link>
        </section>
      </div>

      <Ornamento tipo="jardin" className="mx-auto mt-20 max-w-[1400px] sm:mt-28" />
    </main>
  );
}

/** Una cifra grande y encendida, con su rótulo debajo (en el DOM, el rótulo va primero). */
function Numero({ valor, etiqueta, antes }: { valor: number; etiqueta: string; antes?: string }) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-rule pt-5">
      <dt className="label text-muted-foreground">{etiqueta}</dt>
      <dd className="m-0">
        {antes ? <span className="label block text-(--ember-texto)">{antes}</span> : null}
        <span className="copa-luz block font-display text-[clamp(3.25rem,7vw,6rem)] leading-[0.9] font-semibold tracking-tight text-sun tabular-nums">
          {valor}
        </span>
      </dd>
    </div>
  );
}

/** Un récord: la punta de su lista, con enlace al palmarés filtrado. Si empatan, van todos. */
function Record({
  icono,
  rotulo,
  lista,
  detalle,
}: {
  icono: React.ReactNode;
  rotulo: string;
  lista: Recurrencia[];
  detalle: (r: Recurrencia) => string;
}) {
  if (lista.length === 0) return null;
  return (
    <li className="flex flex-col rounded-2xl border border-rule px-6 py-7">
      <span className="copa-luz inline-flex size-11 items-center justify-center rounded-full border border-sun/50 text-sun">
        {icono}
      </span>
      <p className="label mt-6 text-(--ember-texto)">{rotulo}</p>
      {lista.map((x) => (
        <div key={x.clave} className="mt-2 flex flex-1 flex-col">
          <p className="font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-tight font-semibold tracking-tight">
            {x.nombre}
          </p>
          <p className="mt-2 font-serif text-base leading-relaxed text-muted-foreground">{detalle(x)}</p>
          <Link
            href={`/copa-cata/palmares?q=${encodeURIComponent(x.busqueda)}`}
            className="label mt-auto inline-flex items-center gap-1.5 pt-6 text-(--ember-texto) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {RECORDS.premiosDe(x.nombre)}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      ))}
    </li>
  );
}
