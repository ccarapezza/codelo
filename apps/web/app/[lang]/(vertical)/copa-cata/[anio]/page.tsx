import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Clock,
  Handshake,
  LayoutGrid,
  MapPin,
  Sprout,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { CopaNav } from "@/components/vertical/copa-cata/CopaNav";
import { Galeria, type ItemGaleria } from "@/components/vertical/copa-cata/Galeria";
import { GraficasEdicion } from "@/components/vertical/copa-cata/GraficasEdicion";
import { ObjetosEdicion } from "@/components/vertical/copa-cata/ObjetosEdicion";
import { Ornamento } from "@/components/vertical/copa-cata/Ornamento";
import { PodioEdicion } from "@/components/vertical/copa-cata/PodioEdicion";
import { TituloSeccion } from "@/components/vertical/copa-cata/TituloSeccion";
import { Videos } from "@/components/vertical/copa-cata/Videos";
import type { Video } from "@/components/vertical/copa-cata/VideoClip";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  GRAFICAS,
  ILUSTRACION_EDICION,
  ORNAMENTOS,
  PREMIOS,
  anioDeParam,
  anterior,
  campeonDe,
  getEdicion,
  graficasDe,
  mediosDe,
  objetosDe,
  premiosDe,
  siguiente,
  type Anio,
  type Edicion,
  type Medio,
} from "@/lib/vertical/copa-cata";
import {
  bajadaEdicion,
  cejaEdicion,
  chipsEdicion,
  firmaCronica,
  seoEdicion,
  type DatosBajada,
} from "@/lib/vertical/copa-cata/textos";
import { breadcrumbSchema, localizedAlternates, OG_LOCALE, SITE_LOGO, SITE_NAME, SITE_URL } from "@/lib/seo";

type Params = Promise<{ lang: string; anio: string }>;

const datosDe = (e: Edicion): DatosBajada => ({
  edicion: e,
  campeon: campeonDe(PREMIOS, e.anio),
  premios: premiosDe(e.anio),
});

/**
 * Metadata armada a mano y no con pageMetadata(): aquella fija la tarjeta por
 * defecto del sitio en `openGraph.images`, y con `images` declarado Next no
 * usa la opengraph-image.tsx de esta ruta. Mismo criterio que blog/[slug].
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, anio: param } = await params;
  const anio = anioDeParam(param);
  if (!anio) return {};
  const path = `/copa-cata/${anio}`;
  const { title, description } = seoEdicion(datosDe(getEdicion(anio)));
  return {
    title,
    description,
    alternates: localizedAlternates(lang, path),
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      locale: OG_LOCALE[lang] ?? OG_LOCALE.es,
      url: `/${lang}${path}`,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

type Foto = Extract<Medio, { tipo: "foto" }>;

/** Una foto de la biblioteca de medios como pieza del mosaico. */
function itemDeFoto(f: Foto): ItemGaleria {
  return {
    src: f.url,
    miniatura: f.formats.small ?? f.formats.medium ?? f.formats.thumbnail ?? f.url,
    width: f.width,
    height: f.height,
    alt: f.alt,
  };
}

/** El ícono de cada chip de datos. */
const ICONO_CHIP: Record<string, LucideIcon> = {
  hora: Clock,
  zona: MapPin,
  muestras: Sprout,
  mesas: LayoutGrid,
  cupo: Users,
  entrada: Ticket,
  marcas: Handshake,
};

/** Lo que la noche necesita de la página: el campo de estrellas del cielo. */
const CIELO = { "--estrellas": `url(${ORNAMENTOS.estrellas.src})` } as React.CSSProperties;

export default async function EdicionPage({ params }: { params: Params }) {
  const { lang, anio: param } = await params;
  setRequestLocale(lang);
  const anio = anioDeParam(param);
  if (!anio) notFound();

  const t = await getTranslations("copa");
  const e = getEdicion(anio);
  const datos = datosDe(e);
  const bajada = bajadaEdicion(datos);
  const ilustracion = ILUSTRACION_EDICION[anio];
  const medios = mediosDe(anio);
  const fotos = medios.filter((m): m is Foto => m.tipo === "foto");
  const videos = medios.filter((m): m is Video => m.tipo === "video");
  const graficas = graficasDe(anio);
  const objetos = objetosDe(anio);
  const pieza = GRAFICAS.find((g) => g.id === e.heroGrafica) ?? null;
  const previa = anterior(anio);
  const proxima = siguiente(anio);
  const url = `${SITE_URL}/${lang}/copa-cata/${anio}`;

  return (
    // -mb-24 anula el mt-24 del pie del sitio: la noche apoya directo sobre la
    // banda de tinta, sin la franja de papel en el medio.
    <main className="copa-noche -mb-24" style={CIELO}>
      <JsonLd data={[breadcrumb(lang, e, t("title")), articulo(lang, e, url, bajada)]} />

      <div className="mx-auto w-full max-w-[1400px] px-5 pt-5 sm:px-8">
        <CopaNav actual={anio} />
      </div>

      {/* ---- Encabezado ------------------------------------------------------
          La ilustración de la edición y su pieza de la época (afiche, flyer o
          logo) son las protagonistas; el año, enorme, del otro lado. En el
          teléfono la ilustración va primero. */}
      <header className="mx-auto mt-6 grid w-full max-w-[1400px] items-center gap-x-12 gap-y-4 px-5 sm:px-8 lg:mt-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        {/* Sin z-index: un contexto de apilamiento acá aislaría la mezcla de la
            ilustración con la noche (ver .copa-arte en vertical.css). */}
        <div className="relative lg:order-2">
          <div className="copa-arte copa-fundido copa-flota mx-auto max-w-md lg:max-w-none">
            <Image
              src={ilustracion.src}
              alt={ilustracion.alt}
              width={ilustracion.width}
              height={ilustracion.height}
              priority
              sizes="(min-width: 1024px) 40vw, (min-width: 640px) 28rem, 100vw"
              className="block h-auto w-full"
            />
          </div>
          {pieza ? (
            <div
              className={cn(
                "absolute bottom-[4%] left-0 w-[34%] max-w-52 -rotate-3 sm:left-[4%] lg:-left-[6%] lg:w-[38%] lg:max-w-60",
                pieza.tipo === "logo" && "rounded-lg bg-(--brand-ink) p-3 ring-1 ring-foreground/20",
              )}
            >
              <Image
                src={pieza.src}
                alt={pieza.alt}
                width={pieza.width}
                height={pieza.height}
                sizes="(min-width: 1024px) 15rem, 34vw"
                className={cn(
                  "block h-auto w-full",
                  pieza.tipo !== "logo" &&
                    "rounded-sm shadow-[0_22px_44px_-18px_oklch(0.1_0.05_268/90%)] ring-1 ring-foreground/25",
                )}
              />
            </div>
          ) : null}
        </div>
        <div className="relative z-10 lg:order-1">
          <p className="label text-(--ember-texto)">{cejaEdicion(e)}</p>
          <h1 className="copa-luz mt-3 font-display text-[clamp(6rem,21vw,15rem)] leading-[0.8] font-semibold tracking-tighter tabular-nums">
            {anio}
          </h1>
          <p className="mt-7 max-w-xl font-serif text-lg leading-relaxed text-pretty text-muted-foreground sm:text-xl">
            {bajada}
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* ---- Los datos, en chips ------------------------------------------- */}
        <section aria-label={t("secciones.datos")} className="mt-12 lg:mt-16">
          <ul className="flex flex-wrap gap-2.5">
            {chipsEdicion(e).map((c) => {
              const Icono = ICONO_CHIP[c.clave] ?? Sprout;
              return (
                <li
                  key={c.clave}
                  className="inline-flex max-w-full items-start gap-2.5 rounded-2xl border border-rule bg-card/60 px-4 py-2.5 font-serif text-[0.95rem] leading-snug"
                >
                  <Icono className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden strokeWidth={1.75} />
                  <span className="min-w-0">{c.texto}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- La voz de la crónica, cuando la hay ---------------------------- */}
        {e.cronica ? (
          <figure className="mx-auto mt-20 max-w-4xl text-center">
            <blockquote className="font-serif text-[clamp(1.5rem,3.2vw,2.375rem)] leading-snug text-pretty italic">
              «{e.cronica.cita}»
            </blockquote>
            <figcaption className="label mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-muted-foreground">
              <span>{firmaCronica(e.cronica.autor, e.cronica.fecha)}</span>
              <a
                href={e.cronica.wayback}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-(--ember-texto) underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {t("edicion.cronica")}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
            </figcaption>
          </figure>
        ) : null}
      </div>

      <Ornamento tipo="orbitas" className="mx-auto mt-14 max-w-[1100px] sm:mt-20" />

      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        {/* ---- El podio ------------------------------------------------------ */}
        {datos.premios.length > 0 ? (
          <section aria-labelledby="podio" className="mt-4 sm:mt-8">
            <TituloSeccion id="podio">{t("secciones.podio")}</TituloSeccion>
            <div className="mt-10">
              <PodioEdicion anio={anio} premios={datos.premios} />
            </div>
          </section>
        ) : null}

        {/* ---- Los objetos: credenciales, entradas, rótulos… ---------------------
            Van después del podio o, sin podio, pegados a la banda de órbitas. */}
        {objetos.length > 0 ? (
          <section
            aria-labelledby="objetos"
            className={datos.premios.length > 0 ? "mt-24 sm:mt-32" : "mt-4 sm:mt-8"}
          >
            <TituloSeccion id="objetos">{t("secciones.objetos")}</TituloSeccion>
            <div className="mt-10">
              <ObjetosEdicion objetos={objetos} />
            </div>
          </section>
        ) : null}

        {/* ---- La galería ---------------------------------------------------- */}
        {fotos.length > 0 ? (
          <section aria-labelledby="galeria" className="mt-24 sm:mt-32">
            <TituloSeccion id="galeria">{t("secciones.galeria")}</TituloSeccion>
            <div className="mt-10">
              <Galeria
                items={fotos.map(itemDeFoto)}
                variante="mosaico"
                etiquetas={{
                  lista: t("secciones.galeria"),
                  item: t.raw("galeria.foto") as string,
                  anterior: t("galeria.anterior"),
                  siguiente: t("galeria.siguiente"),
                  cerrar: t("galeria.cerrar"),
                }}
              />
            </div>
          </section>
        ) : null}
      </div>

      {/* ---- Videos y piezas: rieles que corren hasta el borde -------------- */}
      {videos.length > 0 ? (
        <section aria-labelledby="videos" className="mt-24 sm:mt-32">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
            <TituloSeccion id="videos">{t("secciones.videos")}</TituloSeccion>
          </div>
          <div className="mx-auto mt-6 max-w-[1400px] [--riel-margen:1.25rem] sm:[--riel-margen:2rem]">
            <Videos videos={videos} />
          </div>
        </section>
      ) : null}

      {graficas.length > 0 ? (
        <section aria-labelledby="graficas" className="mt-24 sm:mt-32">
          <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
            <TituloSeccion id="graficas">{t("secciones.graficas")}</TituloSeccion>
          </div>
          <div className="mx-auto mt-6 max-w-[1400px] [--riel-margen:1.25rem] sm:[--riel-margen:2rem]">
            <GraficasEdicion graficas={graficas} />
          </div>
        </section>
      ) : null}

      {/* ---- Anterior / siguiente ---------------------------------------------- */}
      <nav
        aria-label={t("nav.vecinas")}
        className="mx-auto mt-24 grid w-full max-w-[1400px] gap-4 px-5 sm:mt-32 sm:grid-cols-2 sm:px-8"
      >
        {previa ? <Vecina anio={previa} rotulo={t("nav.anterior")} lado="anterior" /> : <span aria-hidden className="hidden sm:block" />}
        {proxima ? <Vecina anio={proxima} rotulo={t("nav.siguiente")} lado="siguiente" /> : null}
      </nav>

      <Ornamento tipo="jardin" className="mx-auto mt-16 max-w-[1400px] sm:mt-24" />
    </main>
  );
}

/** Una edición vecina: su ilustración chica, el año y su nombre. Toda la pieza es el enlace. */
function Vecina({ anio, rotulo, lado }: { anio: Anio; rotulo: string; lado: "anterior" | "siguiente" }) {
  const e = getEdicion(anio);
  const ilu = ILUSTRACION_EDICION[anio];
  const derecha = lado === "siguiente";
  return (
    <Link
      href={`/copa-cata/${anio}`}
      rel={derecha ? "next" : "prev"}
      className={cn(
        "copa-brillo group flex items-center gap-5 rounded-2xl border border-rule p-3 pr-5 sm:p-4 sm:pr-6",
        derecha && "flex-row-reverse pr-3 pl-5 text-right sm:col-start-2 sm:pr-4 sm:pl-6",
      )}
    >
      <span className="relative block aspect-4/5 w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
        <Image src={ilu.src} alt="" fill sizes="96px" className="object-cover transition-[filter] duration-300 group-hover:brightness-110" />
      </span>
      <span className="min-w-0">
        <span className={cn("label flex items-center gap-1.5 text-muted-foreground", derecha && "justify-end")}>
          {derecha ? null : <ArrowLeft className="size-3.5" aria-hidden />}
          {rotulo}
          {derecha ? <ArrowRight className="size-3.5" aria-hidden /> : null}
        </span>
        <span className="mt-1.5 block font-display text-4xl leading-none font-semibold tracking-tight tabular-nums sm:text-5xl">
          {anio}
        </span>
        <span className="label mt-2 block text-(--ember-texto)">{e.nombre}</span>
      </span>
    </Link>
  );
}

function breadcrumb(lang: string, e: Edicion, seccion: string) {
  return breadcrumbSchema([
    { name: SITE_NAME, url: `${SITE_URL}/${lang}` },
    { name: seccion, url: `${SITE_URL}/${lang}/copa-cata` },
    { name: `${e.nombre} (${e.anio})`, url: `${SITE_URL}/${lang}/copa-cata/${e.anio}` },
  ]);
}

/**
 * JSON-LD inline, y no eventSchema() del motor: aquel nunca pone a la
 * asociación como organizadora (la agenda del sitio es de terceros). Acá es un
 * Article —la página cuenta historia— cuyo tema es un Event pasado que sí
 * organizó la asociación.
 */
function articulo(lang: string, e: Edicion, url: string, descripcion: string) {
  const inicio = e.horaInicio.valor ? `${e.fecha}T${e.horaInicio.valor}:00-03:00` : e.fecha;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${e.nombre} (${e.anio})`,
    description: descripcion,
    inLanguage: lang,
    url,
    mainEntityOfPage: url,
    // Sin `image`: en una ruta dinámica Next sirve la tarjeta con un sufijo de
    // hash (opengraph-image-xxxx) y la URL pelada da 404. La tarjeta llega a
    // los buscadores por og:image, que sí la apunta bien.
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL, logo: SITE_LOGO },
    about: {
      "@type": "Event",
      name: e.nombre,
      startDate: inicio,
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      ...(e.lugar.valor
        ? {
            location: {
              "@type": "Place",
              name: e.lugar.valor,
              address: { "@type": "PostalAddress", addressLocality: e.lugar.valor, addressCountry: "AR" },
            },
          }
        : {}),
      organizer: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    },
  };
}
