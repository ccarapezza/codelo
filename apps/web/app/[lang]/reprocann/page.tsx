import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  Building2,
  FileText,
  HeartHandshake,
  IdCard,
  Mail,
  Phone,
  Sprout,
} from "lucide-react";
import { JsonLd } from "@/components/JsonLd";
import { Dato } from "@/components/charts/primitivos";
import { getPageBySlug } from "@/lib/content";
import { LAMINAS_TRANS } from "@/lib/laminas";
import { markdownToSafeHtml } from "@/lib/markdown";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const SLUG = "reprocann";

const TITLE = "REPROCANN: la guía del trámite";
const DESCRIPTION =
  "Qué es el REPROCANN, qué autoriza y cómo inscribirte paso a paso. Cantidades permitidas, vigencia, costos y normativa vigente (Res. 1780/2025), con fuentes oficiales.";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata({ lang, path: `/${SLUG}`, title: TITLE, description: DESCRIPTION });
}

/* ── Contenido ─────────────────────────────────────────────────────────────
   Los requisitos legales son hechos no-inventables: todo lo de esta página
   sale de fuente oficial (argentina.gob.ar, instructivo del Ministerio,
   Res. 1780/2025) salvo los TIEMPOS de aprobación, que son reporte de
   prensa/comunidad y están señalados como tales. Si cambia la norma, esta
   página se actualiza — la fecha visible del pie es el contrato.          */

const OFICIAL = {
  registro: "https://www.argentina.gob.ar/salud/cannabis-medicinal/reprocann",
  faq: "https://www.argentina.gob.ar/salud/cannabis-medicinal/frecuentes",
  plataforma: "https://reprocann.msal.gob.ar/",
  instructivo: "https://www.argentina.gob.ar/sites/default/files/2025-02-instructivo_reprocann.pdf",
  res1780: "https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-1780-2025-413121/texto",
  res3132: "https://www.argentina.gob.ar/normativa/nacional/resoluci%C3%B3n-3132-2024-403064/texto",
  ley27350: "https://servicios.infoleg.gob.ar/infolegInternet/verNorma.do?id=344131",
  decreto883: "https://www.boletinoficial.gob.ar/detalleAviso/primera/237208/20201112",
  farmacia:
    "https://www.argentina.gob.ar/salud/cannabis-medicinal/registro-reprocann/como-acceder-medicamentos-de-especialidades-medicinales",
} as const;

const PASOS = [
  {
    titulo: "Validá tu identidad en Mi Argentina",
    detalle:
      "Es obligatorio para todos los roles. Si todavía no tenés cuenta, se crea en el momento; la validación de identidad se hace una sola vez.",
  },
  {
    titulo: "Registrate en la plataforma REPROCANN",
    detalle:
      "Entrás con tu cuenta de Mi Argentina y elegís el rol: paciente y/o autocultivador. El sistema precarga tus datos; completás domicilio, cobertura de salud y contacto.",
  },
  {
    titulo: "Elegí quién cultiva",
    detalle:
      "Autocultivo (declarás el domicilio donde están las plantas, editable si te mudás) o un tercero: cultivador solidario u ONG inscripta.",
  },
  {
    titulo: "Vinculate con tu médico",
    detalle:
      "En «Mis datos» el sistema genera un código de vinculación: se lo pasás a tu profesional. El trámite se inicia recién con esta vinculación. Si cultiva un tercero, esa segunda vinculación va después.",
  },
  {
    titulo: "El médico firma el consentimiento",
    detalle:
      "Un profesional inscripto —registrado en el REFEPS, con formación en cannabis medicinal y firma digital— adjunta la documentación y presenta el consentimiento informado bilateral.",
  },
  {
    titulo: "Aprobación y credencial",
    detalle:
      "Seguís el estado en «Mis trámites». Cuando se aprueba te avisa por mail y descargás la credencial desde la misma plataforma. Vale 3 años.",
  },
] as const;

const VIAS = [
  {
    icono: Sprout,
    titulo: "Autocultivo",
    bajada: "Cultivás vos, en tu domicilio declarado.",
    limites: ["1 a 9 plantas en floración", "Hasta 6 m² en interior", "Hasta 15 m² a cielo abierto"],
  },
  {
    icono: HeartHandshake,
    titulo: "Cultivador solidario",
    bajada:
      "Una persona cultiva para sí y para un único usuario más, con conformidad de ambos y sin antecedentes por la ley de estupefacientes.",
    limites: [
      "Cultiva para sí + 1 usuario",
      "Informe cromatográfico por lote",
      "Declaración jurada semestral",
    ],
  },
  {
    icono: Building2,
    titulo: "ONG cultivadora",
    bajada:
      "Asociaciones civiles y fundaciones con objeto social alineado a la Ley 27.350, con director médico y responsable técnico agrícola.",
    limites: [
      "Hasta 150 personas representadas",
      "Hasta 3 domicilios de cultivo",
      "Renovación anual",
    ],
  },
] as const;

const NORMAS = [
  {
    anio: "2017",
    nombre: "Ley 27.350",
    detalle: "El marco: investigación médica y científica del uso medicinal del cannabis.",
    href: OFICIAL.ley27350,
    vigente: true,
  },
  {
    anio: "2020",
    nombre: "Decreto 883/2020",
    detalle:
      "Reglamenta la ley y crea el REPROCANN. Habilita el autocultivo, el cultivador solidario y las ONG.",
    href: OFICIAL.decreto883,
    vigente: true,
  },
  {
    anio: "2021",
    nombre: "Resolución 800/2021",
    detalle:
      "Puso en funcionamiento el registro. Su texto fue sustituido casi por completo por la norma de 2025.",
    href: null,
    vigente: true,
  },
  {
    anio: "2024",
    nombre: "Resolución 3132/2024",
    detalle:
      "Endureció los requisitos para médicos y cultivadores. Derogada: si una guía la cita, está desactualizada.",
    href: OFICIAL.res3132,
    vigente: false,
  },
  {
    anio: "2025",
    nombre: "Resolución 1780/2025",
    detalle:
      "La norma operativa vigente. Redefine las categorías, las cantidades, los requisitos del profesional y las vigencias.",
    href: OFICIAL.res1780,
    vigente: true,
    destacada: true,
  },
  {
    anio: "2026",
    nombre: "Traspaso a la Sedronar",
    detalle:
      "La gestión operativa del programa pasó a la Sedronar en enero de 2026, según reportó la prensa especializada.",
    href: null,
    vigente: true,
  },
] as const;

const PREGUNTAS = [
  {
    pregunta: "¿Cuánto cuesta?",
    respuesta:
      "La inscripción no tiene costo: el Estado no cobra ni por el trámite ni por el certificado. Lo que sí puede costar es la consulta con el profesional que hace la indicación y firma el consentimiento, salvo que te atiendas en el sistema público.",
  },
  {
    pregunta: "¿Qué condiciones de salud entran?",
    respuesta:
      "La normativa no publica una lista de patologías. Habla de indicación médica basada en evidencia científica, con fines de tratamiento medicinal, terapéutico o paliativo del dolor: el criterio es del profesional tratante inscripto, que es responsable de la prescripción y su seguimiento.",
  },
  {
    pregunta: "¿Cuánto dura el certificado y cómo se renueva?",
    respuesta:
      "Para autocultivadores vale 3 años desde la emisión; para asociaciones civiles y fundaciones, 1 año con presentación anual de documentación. Para renovar, tu médico tiene que ratificar la indicación terapéutica; el detalle del procedimiento no está publicado en las páginas oficiales, consultalo con tu profesional.",
  },
  {
    pregunta: "¿Qué muestro en un control?",
    respuesta:
      "La credencial vigente junto con el DNI. Dentro de los límites autorizados —hasta 9 plantas en floración y hasta 40 gramos de flores secas o 6 frascos de 30 ml en tránsito— la tenencia está autorizada por el registro.",
  },
  {
    pregunta: "¿Necesito REPROCANN para comprar en farmacia?",
    respuesta:
      "No. La compra de especialidades medicinales o formulaciones magistrales en farmacia se hace con receta, sin inscripción en el registro. El REPROCANN es la vía para el cultivo controlado.",
  },
  {
    pregunta: "¿Dónde encuentro un médico inscripto?",
    respuesta:
      "No hay un listado oficial público de profesionales inscriptos. El profesional debe estar registrado en el REFEPS y contar con formación acreditada en cannabis medicinal; las comunidades cannábicas mantienen listados no oficiales que pueden servir de punto de partida.",
  },
] as const;

const ENLACES = [
  { titulo: "Plataforma de inscripción", detalle: "reprocann.msal.gob.ar", href: OFICIAL.plataforma },
  { titulo: "Página oficial del registro", detalle: "argentina.gob.ar", href: OFICIAL.registro },
  { titulo: "Preguntas frecuentes oficiales", detalle: "argentina.gob.ar", href: OFICIAL.faq },
  { titulo: "Instructivo de inscripción", detalle: "PDF · Ministerio de Salud", href: OFICIAL.instructivo },
  { titulo: "Resolución 1780/2025", detalle: "Texto completo de la norma vigente", href: OFICIAL.res1780 },
  { titulo: "Acceso por farmacia, sin REPROCANN", detalle: "argentina.gob.ar", href: OFICIAL.farmacia },
] as const;

function ExternoIcono() {
  return <ArrowUpRight className="size-3.5 shrink-0" aria-hidden />;
}

export default async function ReprocannPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const page = await getPageBySlug(SLUG);
  const notaCms = page?.content?.trim() ? markdownToSafeHtml(page.content) : null;

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: PREGUNTAS.map(p => ({
            "@type": "Question",
            name: p.pregunta,
            acceptedAnswer: { "@type": "Answer", text: p.respuesta },
          })),
        }}
      />

      {/* ---- Cabecera --------------------------------------------------- */}
      <header className="section-rule grid pt-5 pb-8 lg:grid-cols-[1fr_minmax(280px,380px)] lg:items-end lg:gap-12">
        <div>
          <p className="label text-ember">Guía del trámite</p>
          <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
            REPROCANN
          </h1>
          <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
            El registro que autoriza el cultivo controlado de cannabis con fines medicinales,
            terapéuticos o paliativos del dolor. Qué habilita, cómo se saca paso a paso y qué
            dice la norma vigente — todo con fuente oficial.
          </p>
        </div>
        {/* Lámina de la casa en transparente; dos bakes por tema — lib/laminas.ts */}
        <div className="relative hidden aspect-[16/9] lg:block">
          <Image
            src={LAMINAS_TRANS.hoja.light}
            alt=""
            fill
            sizes="380px"
            className="object-contain dark:hidden"
          />
          <Image
            src={LAMINAS_TRANS.hoja.dark}
            alt=""
            fill
            sizes="380px"
            className="hidden object-contain dark:block"
          />
        </div>
      </header>

      {/* ---- Los cuatro números que importan ---------------------------- */}
      <section aria-label="El trámite en números" className="mt-2">
        <div className="grid grid-cols-2 gap-x-6 gap-y-7 sm:gap-x-10 lg:grid-cols-4">
          <Dato
            destacado
            colorDestacado="var(--ember)"
            valor="9"
            etiqueta="Plantas en floración"
            nota="El máximo por paciente, en hasta 6 m² de interior o 15 m² a cielo abierto."
          />
          <Dato
            valor="40 g"
            etiqueta="Transporte autorizado"
            nota="De flores secas. O hasta 6 frascos o goteros de 30 ml."
          />
          <Dato
            valor="3 años"
            etiqueta="Vigencia del certificado"
            nota="Para autocultivadores. Las personas jurídicas renuevan cada año."
          />
          <Dato
            valor="$ 0"
            etiqueta="Costo del trámite"
            nota="La inscripción es gratuita. La consulta médica corre aparte."
          />
        </div>
        <p className="label mt-5 text-muted-foreground">
          Cantidades y vigencias de la{" "}
          <a
            href={OFICIAL.res1780}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ember hover:underline"
          >
            Resolución 1780/2025
          </a>{" "}
          y de las{" "}
          <a
            href={OFICIAL.faq}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ember hover:underline"
          >
            preguntas frecuentes oficiales
          </a>
          .
        </p>
      </section>

      {/* ---- Actualidad: el trámite se destrabó -------------------------
          Recuadro de diario (mismo recurso que el panel del Boletín). Es el
          único bloque de la página cuya fuente NO es oficial, y lo dice.  */}
      <section aria-label="Cuánto demora hoy" className="boletin-panel mt-14 px-5 py-6 sm:px-8">
        <div className="grid gap-x-10 gap-y-4 md:grid-cols-[auto_1fr] md:items-start">
          <div>
            <p className="label text-ember">Cuánto demora hoy</p>
            <p className="mt-2 font-display text-[clamp(2.5rem,6vw,3.5rem)] leading-none font-semibold">
              24–72 h
            </p>
            <p className="label mt-2 text-muted-foreground">Reporte de comunidad · 2026</p>
          </div>
          <div className="max-w-2xl">
            <p className="font-serif text-base leading-relaxed">
              Desde fines de febrero de 2026 el registro aprueba de forma automatizada los
              trámites simples, y la prensa y las comunidades cannábicas coinciden: con la
              documentación completa, el certificado está saliendo en 24 a 72 horas — antes
              demoraba meses. Los expedientes iniciados antes de la automatización siguen otra
              cola, más lenta.
            </p>
            <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
              No hay cifra oficial publicada: esto es lo que reporta la comunidad, no una promesa
              del Estado. Fuentes:{" "}
              <a
                href="https://pelagatos.com.ar/2026/02/24/reprocann-el-sistema-empezaria-a-aprobar-tramites-de-forma-automatizada/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ember hover:underline"
              >
                PelaGatos
              </a>{" "}
              y{" "}
              <a
                href="https://www.diariodecuyo.com.ar/san-juan/reprocann-estrena-nuevo-sistema-aprobacion-48-horas-pero-la-letra-chica-genera-preocupacion-n6568046"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ember hover:underline"
              >
                Diario de Cuyo
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ---- Qué es ------------------------------------------------------ */}
      <section aria-label="Qué es el REPROCANN" className="mt-16">
        <h2 className="section-rule label pt-3 pb-4 text-ink">Qué es y a quién le sirve</h2>
        <div className="grid gap-x-12 gap-y-6 lg:grid-cols-2">
          <p className="font-serif text-lg leading-relaxed">
            El REPROCANN es el registro nacional creado por el Decreto 883/2020 —que reglamenta
            la Ley 27.350— para autorizar el cultivo controlado de cannabis a personas con
            indicación médica. Con la credencial, el paciente puede cultivar en su domicilio o
            delegar el cultivo en un tercero autorizado, y transportar sus flores o aceites
            dentro de los límites del registro.
          </p>
          <div className="font-serif text-base leading-relaxed text-muted-foreground">
            <p>
              La indicación siempre la hace un profesional de la salud inscripto: la norma no
              publica una lista de condiciones habilitadas, el criterio médico es el que manda.
              Y el registro no es la única puerta — las especialidades medicinales y
              formulaciones magistrales se compran en farmacia con receta,{" "}
              <a
                href={OFICIAL.farmacia}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-ember hover:underline"
              >
                sin necesidad de REPROCANN
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* ---- Paso a paso ------------------------------------------------- */}
      <section aria-label="El trámite paso a paso" className="mt-16">
        <h2 className="section-rule label pt-3 pb-1 text-ink">El trámite, paso a paso</h2>
        <p className="mb-5 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground">
          Todo se hace online en{" "}
          <a
            href={OFICIAL.plataforma}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ember hover:underline"
          >
            reprocann.msal.gob.ar
          </a>
          , según el instructivo oficial del Ministerio de Salud.
        </p>
        <ol className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {PASOS.map((paso, i) => (
            <li key={paso.titulo} className="bg-background p-5">
              <p className="font-display text-4xl leading-none font-semibold text-ember">
                {i + 1}
              </p>
              <h3 className="mt-3 font-display text-xl leading-tight font-semibold">
                {paso.titulo}
              </h3>
              <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">
                {paso.detalle}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Las tres vías de cultivo ------------------------------------ */}
      <section aria-label="Las tres vías de cultivo" className="mt-16">
        <h2 className="section-rule label pt-3 pb-1 text-ink">Quién puede cultivar</h2>
        <p className="mb-5 max-w-2xl font-serif text-base leading-relaxed text-muted-foreground">
          La credencial ampara tres formas de cultivo. Ojo con las guías viejas: hasta 2025 el
          cultivador solidario podía tener dos pacientes; la Resolución 1780/2025 lo limita a
          uno.
        </p>
        <ul className="grid gap-px bg-rule sm:grid-cols-3">
          {VIAS.map(via => {
            const Icono = via.icono;
            return (
              <li key={via.titulo} className="flex h-full flex-col bg-background p-5">
                <Icono className="size-6 text-ember" aria-hidden strokeWidth={1.5} />
                <h3 className="mt-3 font-display text-xl leading-tight font-semibold">
                  {via.titulo}
                </h3>
                <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">
                  {via.bajada}
                </p>
                <ul className="mt-4 space-y-1.5 border-t border-rule pt-3">
                  {via.limites.map(limite => (
                    <li key={limite} className="label text-foreground/80">
                      {limite}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ---- Marco legal ------------------------------------------------- */}
      <section aria-label="Marco legal" className="mt-16">
        <h2 className="section-rule label pt-3 pb-4 text-ink">La norma, en el tiempo</h2>
        <ol>
          {NORMAS.map(norma => (
            <li
              key={norma.nombre}
              className="grid grid-cols-[3.5rem_1fr] gap-x-5 border-b border-rule py-4 sm:grid-cols-[5rem_1fr]"
            >
              <p className="label pt-1 text-ember">{norma.anio}</p>
              <div>
                <h3
                  className={cn(
                    "font-display text-lg leading-tight font-semibold",
                    !norma.vigente && "text-muted-foreground line-through decoration-1",
                  )}
                >
                  {norma.nombre}
                  {"destacada" in norma && norma.destacada ? (
                    <span className="label ml-3 align-middle text-ember">Vigente</span>
                  ) : null}
                  {!norma.vigente ? (
                    <span className="label ml-3 align-middle text-muted-foreground no-underline">
                      Derogada
                    </span>
                  ) : null}
                </h3>
                <p className="mt-1 max-w-2xl font-serif text-sm leading-relaxed text-muted-foreground">
                  {norma.detalle}
                </p>
                {norma.href ? (
                  <a
                    href={norma.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="label mt-1.5 inline-flex items-center gap-1 text-ember hover:underline"
                  >
                    Texto oficial
                    <ExternoIcono />
                  </a>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- Preguntas frecuentes ---------------------------------------- */}
      <section aria-label="Preguntas frecuentes" className="mt-16">
        <h2 className="section-rule label pt-3 pb-4 text-ink">Preguntas frecuentes</h2>
        <div className="border-t border-rule">
          {PREGUNTAS.map(p => (
            <details key={p.pregunta} className="group border-b border-rule">
              <summary className="flex cursor-pointer list-none items-baseline justify-between gap-4 py-4 font-display text-lg leading-tight font-semibold [&::-webkit-details-marker]:hidden">
                {p.pregunta}
                <span
                  aria-hidden
                  className="label shrink-0 text-ember transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="max-w-3xl pb-5 font-serif text-base leading-relaxed text-muted-foreground">
                {p.respuesta}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* ---- Enlaces oficiales y contacto -------------------------------- */}
      <section aria-label="Enlaces oficiales" className="mt-16">
        <h2 className="section-rule label pt-3 pb-4 text-ink">Fuentes oficiales</h2>
        <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
          {ENLACES.map(enlace => (
            <li key={enlace.titulo} className="bg-background">
              <a
                href={enlace.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col p-5 hover:bg-muted/40"
              >
                <FileText className="size-5 text-ember" aria-hidden strokeWidth={1.5} />
                <h3 className="mt-3 flex items-baseline gap-1.5 font-display text-base leading-tight font-semibold group-hover:underline">
                  {enlace.titulo}
                  <ExternoIcono />
                </h3>
                <p className="label mt-1.5 text-muted-foreground">{enlace.detalle}</p>
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-2">
          <p className="label flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4 text-ember" aria-hidden strokeWidth={1.5} />
            <a href="mailto:programacannabis@msal.gov.ar" className="hover:text-ember">
              programacannabis@msal.gov.ar
            </a>
          </p>
          <p className="label flex items-center gap-2 text-muted-foreground">
            <Phone className="size-4 text-ember" aria-hidden strokeWidth={1.5} />
            0800-222-1002
          </p>
          <p className="label flex items-center gap-2 text-muted-foreground">
            <IdCard className="size-4 text-ember" aria-hidden strokeWidth={1.5} />
            El trámite oficial es gratuito
          </p>
        </div>
      </section>

      {/* ---- Nota de la asociación (CMS), si existe ----------------------- */}
      {notaCms ? (
        <section aria-label="Nota de la asociación" className="mt-16">
          <h2 className="section-rule label pt-3 pb-4 text-ink">Nota de la asociación</h2>
          <article
            className={cn(
              "prose prose-lg max-w-3xl",
              "prose-headings:tracking-tight prose-headings:text-foreground",
              "prose-p:font-serif prose-p:leading-[1.75] prose-p:text-foreground/90",
              "prose-strong:font-semibold prose-strong:text-foreground",
              "prose-a:text-ember prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
              "prose-ul:font-serif prose-ol:font-serif prose-li:leading-[1.7] prose-li:text-foreground/90 prose-li:marker:text-ember",
            )}
            dangerouslySetInnerHTML={{ __html: notaCms }}
          />
        </section>
      ) : null}

      {/* ---- Procedencia — misma nota al pie que /semillas ---------------- */}
      <section className="mt-16 border-y border-rule bg-muted/30 px-5 py-5 sm:px-6">
        <h2 className="label text-ember">De dónde sale esta guía</h2>
        <p className="mt-2 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
          Los requisitos, cantidades y vigencias salen de fuentes oficiales: la página del
          registro en argentina.gob.ar, el instructivo del Ministerio de Salud y el texto de la
          Resolución 1780/2025. Los tiempos de aprobación son reportes de prensa y de la
          comunidad, y están señalados como tales. Esta página no es un canal del Estado y no
          reemplaza la consulta con un profesional de la salud inscripto, que es quien hace la
          indicación.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <a
            href={OFICIAL.registro}
            target="_blank"
            rel="noopener noreferrer"
            className="label inline-flex items-center gap-1 text-ember hover:underline"
          >
            Fuente oficial
            <ExternoIcono />
          </a>
          <p className="label text-muted-foreground">Actualizada a julio de 2026</p>
        </div>
      </section>
    </main>
  );
}
