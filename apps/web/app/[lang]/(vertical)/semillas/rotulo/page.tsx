import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return pageMetadata({
    lang,
    path: "/semillas/rotulo",
    title: "Cómo leer un rótulo de semillas",
    description:
      "Qué campos debe llevar por ley el rótulo de un paquete de semillas de cannabis o cáñamo en Argentina, y cómo verificarlos en los registros públicos de INASE.",
  });
}

const INASE_ROTULADO = "https://www.argentina.gob.ar/inase/rotulado-de-semillas";
const RES_260 = "https://www.boletinoficial.gob.ar/detalleAviso/primera/265629/20220705";

/** Campos obligatorios del rótulo según Res. INASE 260/2022. */
const CAMPOS: Array<{ campo: string; detalle: string; verificable?: string }> = [
  {
    campo: "Nombre y N° de inscripción en el RNCyFS",
    detalle:
      "Identifica a quien fracciona y rotula el paquete. Es un número seguido de letras, por ejemplo 13481EFK1: el número es la inscripción y las letras son las categorías habilitadas.",
    verificable: "operadores",
  },
  {
    campo: "Nombre común y nombre botánico de la especie",
    detalle: "Cannabis o cáñamo, y Cannabis sativa L.",
  },
  {
    campo: "Nombre del cultivar",
    detalle:
      "Obligatorio desde la Res. 260/2022. Es el dato que permite rastrear la variedad hasta su obtentor en el Catálogo Nacional.",
    verificable: "cultivares",
  },
  {
    campo: "Clase: «IDENTIFICADA NOMINADA»",
    detalle: "Es la única clase prevista para semilla de cannabis.",
  },
  { campo: "Contenido neto", detalle: "Cantidad de semillas del paquete." },
  { campo: "País de origen", detalle: "Sólo si la semilla es importada." },
  { campo: "Año de cosecha", detalle: "El año en que se produjo la semilla." },
  {
    campo: "Porcentaje de germinación mínimo",
    detalle:
      "Ojo: es un piso declarado, no el resultado de un análisis. El rótulo no informa la fecha del ensayo ni el poder germinativo medido.",
  },
  {
    campo: "Porcentaje de pureza físico-botánica",
    detalle: "Proporción de semilla de la especie declarada sobre el contenido total.",
  },
  {
    campo: "«SEMILLA CURADA – VENENO», en rojo",
    detalle: "Sólo cuando la semilla fue tratada con curasemillas.",
  },
  {
    campo: "Cláusula de responsabilidad por germinación",
    detalle:
      "El identificador responde por la germinación durante 45 días desde la entrega. En la práctica, ése es el reloj real del rótulo: no hay fecha de vencimiento impresa.",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="section-rule label pt-3 pb-3 text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default async function RotuloPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <Link
        href="/semillas"
        className="label mt-6 inline-flex items-center gap-1 text-ember hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        Volver a semillas
      </Link>

      <header className="section-rule mt-4 pt-5 pb-8">
        <p className="label text-ember">Guía práctica</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          Cómo leer un rótulo de semillas
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          La Resolución INASE 260/2022 fija qué debe decir el rótulo de un paquete de semillas de
          cannabis o cáñamo. Conocer esos campos es la forma más directa de saber qué estás
          comprando.
        </p>
      </header>

      <Section title="Qué tiene que decir el rótulo">
        <ul className="border-t border-rule">
          {CAMPOS.map(c => (
            <li key={c.campo} className="border-b border-rule py-5">
              <h3 className="font-serif text-lg leading-snug font-semibold">{c.campo}</h3>
              <p className="mt-1.5 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
                {c.detalle}
              </p>
              {c.verificable === "operadores" ? (
                <Link
                  href="/semillas/operadores"
                  className="label mt-2 inline-flex items-center gap-1 text-ember hover:underline"
                >
                  Verificar en el padrón
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : null}
              {c.verificable === "cultivares" ? (
                <Link
                  href="/semillas"
                  className="label mt-2 inline-flex items-center gap-1 text-ember hover:underline"
                >
                  Buscar el cultivar
                  <ArrowUpRight className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="La estampilla">
        <div className="max-w-3xl space-y-4 font-serif text-base leading-relaxed text-muted-foreground">
          <p>
            Además del texto, el rótulo lleva pegada una estampilla de seguridad de 2×2 cm que se
            solicita a INASE, es intransferible entre operadores y está asociada a lotes de
            producción concretos. Trae impreso un código DataMatrix y, debajo, el mismo dato en
            texto: una serie de catorce caracteres, como <code>01CAA000254089</code>.
          </p>
          <p>
            {/* Decirlo explícitamente evita que alguien lea el escaneo como una
                validación oficial. Verificado sobre paquetes reales: el
                DataMatrix contiene sólo esa serie, y no existe endpoint público
                donde contrastarla. */}
            <strong className="text-ink">
              Esa serie identifica el paquete, pero no lo valida.
            </strong>{" "}
            INASE no publica ninguna consulta abierta donde contrastarla: la verificación de la
            estampilla sólo existe dentro de su aplicación móvil oficial. Lo que sí podés verificar
            por tu cuenta es lo que está impreso en texto — el cultivar y el número de inscripción
            del identificador —, y para eso sirven las dos consultas de esta sección.
          </p>
        </div>
      </Section>

      <Section title="Dos precisiones que conviene tener claras">
        <div className="max-w-3xl space-y-4 font-serif text-base leading-relaxed text-muted-foreground">
          <p>
            <strong className="text-ink">El obtentor no es el identificador.</strong> Quien registró
            la genética en el Catálogo Nacional suele ser una persona o entidad distinta de la
            empresa que fracciona y rotula el paquete. Son dos registros separados: el cultivar
            tiene su obtentor, y el rótulo lleva el número del identificador.
          </p>
          <p>
            <strong className="text-ink">El RNC y el RNPC no son lo mismo.</strong> La inscripción
            en el Registro Nacional de Cultivares (RNC) habilita la comercialización de la variedad;
            el título del Registro Nacional de la Propiedad de Cultivares (RNPC) protege al obtentor
            por veinte años, pero por sí solo no habilita la venta. Un cultivar puede tener uno, el
            otro, o ambos.
          </p>
        </div>
      </Section>

      <Section title="Fuentes">
        <ul className="label flex flex-col gap-2">
          <li>
            <a
              href={RES_260}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ember hover:underline"
            >
              Resolución INASE 260/2022 — Boletín Oficial
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </li>
          <li>
            <a
              href={INASE_ROTULADO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-ember hover:underline"
            >
              INASE — Rotulado de semillas
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          </li>
        </ul>
      </Section>
    </main>
  );
}
