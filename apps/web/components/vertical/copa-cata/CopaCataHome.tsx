import type { CSSProperties } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Sparkle, Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  EDICIONES,
  ILUSTRACION_EDICION,
  ILUSTRACION_PORTADA,
  ORNAMENTOS,
  PREMIOS,
  campeonDe,
  enNumeros,
} from "@/lib/vertical/copa-cata";
import { NUMEROS, PRIMERA_RONDA, bajadaHome, cejaPortada } from "@/lib/vertical/copa-cata/textos";
import { cn } from "@/lib/utils";
import { Riel } from "./Riel";

const numeros = enNumeros(EDICIONES, PREMIOS);

/** El cielo de la ventana: el mismo campo de estrellas que el de la sección. */
const CIELO = { "--estrellas": `url(${ORNAMENTOS.estrellas.src})` } as CSSProperties;

/**
 * La Copa Cata en la portada del sitio: una ventana de noche, fija, que se abre
 * después de las notas. Es el acceso directo a la sección y un resumen de lo
 * que fue: la ilustración de portada, la ceja y el título, cuatro cifras, la
 * tira de las ocho ediciones y los dos accesos.
 *
 * Todo sale de los datos y los textos de la sección; acá no se escribe nada.
 * Adentro rigen los tokens de la noche (`.copa-noche`), en los dos temas del
 * sitio, así que no lleva `dark:`. El marco y la tira son de `.copa-ventana`
 * (vertical.css): la ventana es contenedor de consultas, y la tira pasa de riel
 * a fila fija según su ancho, no el de la pantalla.
 */
export async function CopaCataHome({ className }: { className?: string }) {
  const t = await getTranslations("copa");

  return (
    <section
      aria-labelledby="copa-cata-home"
      className={cn("copa-noche copa-ventana", className)}
      style={CIELO}
    >
      {/* La ilustración se imprime sobre la noche y se apaga abajo. El texto va
          después y no encima: montada sobre el fundido, como en la portada de
          la sección, la ceja caía sobre estrellas y órbitas del dibujo que
          todavía se ven ahí, y bajaba a 2,4:1 (768 px) y 3,4:1 (1440). */}
      <div className="copa-arte copa-fundido-abajo relative aspect-video overflow-hidden sm:aspect-2/1">
        <div className="copa-flota absolute inset-0">
          <Image
            src={ILUSTRACION_PORTADA.src}
            alt={ILUSTRACION_PORTADA.alt}
            fill
            sizes="(min-width: 1400px) 880px, (min-width: 1024px) 62vw, (min-width: 640px) calc(100vw - 4rem), calc(100vw - 2.5rem)"
            className="object-cover"
          />
        </div>
      </div>

      <div className="relative px-5 sm:px-10">
        <p className="label text-(--ember-texto)">
          {cejaPortada(numeros.ediciones, numeros.desde, numeros.hasta)}
        </p>
        <h2
          id="copa-cata-home"
          className="mt-3 font-display text-[clamp(2.5rem,8cqi,4.5rem)] leading-[0.92] font-semibold tracking-tight text-balance"
        >
          {t("title")}
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
          {bajadaHome(numeros.ediciones)}
        </p>

        <dl className="mt-7 grid grid-cols-2 gap-4 sm:mt-8 sm:grid-cols-4 sm:gap-6">
          <Cifra valor={numeros.ediciones} etiqueta={NUMEROS.copas} />
          <Cifra valor={numeros.premios} etiqueta={NUMEROS.premios} />
          <Cifra valor={numeros.geneticas} etiqueta={NUMEROS.geneticas} />
          <Cifra valor={numeros.ganadores} etiqueta={NUMEROS.ganadores} />
        </dl>
      </div>

      {/* La tira: el margen del riel es el del texto, así la primera edición
          arranca alineada con la ceja. El rótulo guarda la altura de las
          flechas del riel, que flotan a su lado; en el teléfono no hay flechas
          (va el dedo), y con las ocho a la vista (fila fija, 50rem: ver
          .copa-tira en vertical.css) tampoco. */}
      <div className="copa-tira mt-8 [--riel-margen:1.25rem] sm:mt-10 sm:[--riel-margen:2.5rem]">
        <h3 className="label flex items-center gap-2 px-(--riel-margen) text-muted-foreground sm:min-h-10 @min-[50rem]:min-h-0">
          <Sparkle className="size-3.5 shrink-0 text-sun" aria-hidden strokeWidth={1.75} />
          {t("secciones.ediciones")}
        </h3>
        <Riel
          etiqueta={t("secciones.ediciones")}
          anterior={t("riel.anterior")}
          siguiente={t("riel.siguiente")}
          className="mt-3"
        >
          {EDICIONES.map(e => {
            const c = campeonDe(PREMIOS, e.anio);
            return (
              <li key={e.anio}>
                {/* Toda la pieza es el enlace; la ilustración va con alt vacío
                    porque la nombran el año y el texto (como en el riel de la
                    sección). */}
                <Link
                  href={`/copa-cata/${e.anio}`}
                  className="copa-brillo group block h-full rounded-xl p-1.5"
                >
                  <span className="relative block aspect-4/5 overflow-hidden rounded-lg">
                    <Image
                      src={ILUSTRACION_EDICION[e.anio].src}
                      alt=""
                      fill
                      // Desde 1400 px la ventana siempre tiene la fila fija, con piezas de ~80 px.
                      sizes="(min-width: 1400px) 6rem, (min-width: 640px) 9.5rem, 7.75rem"
                      className="object-cover transition-[filter] duration-300 group-hover:brightness-110"
                    />
                  </span>
                  <span className="block px-0.5 pt-3 pb-1">
                    <span className="block font-display text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
                      {e.anio}
                    </span>
                    {c ? (
                      <span className="mt-2 block font-serif text-[0.8125rem] leading-snug">
                        <span className="block text-foreground">
                          <Trophy
                            className="mr-1 inline size-3.5 align-[-0.125em] text-sun"
                            aria-hidden
                            strokeWidth={1.75}
                          />
                          {c.ganador}
                        </span>
                        {c.genetica ? (
                          <span className="mt-0.5 block text-muted-foreground">{c.genetica}</span>
                        ) : null}
                      </span>
                    ) : e.numero === 1 ? (
                      <span className="mt-2 block font-serif text-[0.8125rem] leading-snug text-muted-foreground">
                        {PRIMERA_RONDA}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </Riel>
      </div>

      {/* En el teléfono, uno debajo del otro y a todo el ancho: lado a lado no
          entran, y cortados en dos filas desparejas se leían como un error. */}
      <div className="grid gap-2.5 px-5 pt-3 pb-6 sm:flex sm:flex-wrap sm:gap-3 sm:px-10 sm:pb-10">
        <Link
          href="/copa-cata"
          className="copa-brillo label inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-sun px-6 text-(--noche) hover:bg-sun/90"
        >
          {t("home.entrar")}
          <ArrowRight className="size-4" aria-hidden strokeWidth={1.75} />
        </Link>
        <Link
          href="/copa-cata/palmares"
          className="copa-brillo label inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-sun/50 px-6 text-sun hover:bg-sun/10"
        >
          <Trophy className="size-4" aria-hidden strokeWidth={1.75} />
          {t("nav.palmares")}
        </Link>
      </div>
    </section>
  );
}

/**
 * Una cifra grande y encendida con su rótulo (en el DOM, el rótulo va primero).
 * En el teléfono el rótulo va al costado, para que las cuatro entren en dos
 * filas bajas; desde sm, debajo, como en la sección.
 */
function Cifra({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    // `justify-end` empaqueta hacia el final del eje invertido: a la izquierda en
    // fila y arriba en columna, así las cifras quedan alineadas aunque un
    // rótulo ocupe dos líneas.
    <div className="flex flex-row-reverse items-center justify-end gap-2.5 border-t border-rule pt-3 sm:flex-col-reverse sm:items-start sm:gap-2 sm:pt-4">
      <dt className="label min-w-0 text-muted-foreground">{etiqueta}</dt>
      <dd className="m-0">
        <span className="copa-luz block font-display text-[clamp(2.25rem,7.5cqi,4.25rem)] leading-[0.9] font-semibold tracking-tight text-sun tabular-nums">
          {valor}
        </span>
      </dd>
    </div>
  );
}
