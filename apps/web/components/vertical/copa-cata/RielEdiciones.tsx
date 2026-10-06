import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { EDICIONES, ILUSTRACION_EDICION, PREMIOS, campeonDe } from "@/lib/vertical/copa-cata";
import { PRIMERA_RONDA } from "@/lib/vertical/copa-cata/textos";
import { Riel } from "./Riel";

/**
 * Las ediciones como un riel de piezas grandes: la ilustración de cada una, el
 * año, su nombre y quién se llevó la copa con qué genética. Toda la pieza es
 * el enlace. La ilustración va con `alt` vacío: dentro del enlace la nombran
 * el año y el texto, y su descripción haría eterno el nombre del enlace.
 */
export async function RielEdiciones() {
  const t = await getTranslations("copa");
  return (
    <Riel etiqueta={t("secciones.ediciones")} anterior={t("riel.anterior")} siguiente={t("riel.siguiente")}>
      {EDICIONES.map((e) => {
        const c = campeonDe(PREMIOS, e.anio);
        const ilu = ILUSTRACION_EDICION[e.anio];
        return (
          <li key={e.anio} className="w-[min(76vw,18rem)] sm:w-72">
            <Link href={`/copa-cata/${e.anio}`} className="copa-brillo group block rounded-xl p-2">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-lg">
                <Image
                  src={ilu.src}
                  alt=""
                  fill
                  sizes="(min-width: 640px) 288px, 76vw"
                  className="object-cover transition-[filter] duration-300 group-hover:brightness-110"
                />
              </span>
              <span className="block px-1 pt-4 pb-1">
                <span className="block font-display text-5xl leading-none font-semibold tracking-tight tabular-nums">
                  {e.anio}
                </span>
                <span className="label mt-2.5 block text-(--ember-texto)">{e.nombre}</span>
                {c ? (
                  <span className="mt-3 flex gap-2.5 font-serif text-[0.95rem] leading-snug">
                    <Trophy className="mt-0.5 size-4 shrink-0 text-sun" aria-hidden strokeWidth={1.75} />
                    <span>
                      <span className="text-foreground">{c.ganador}</span>
                      {c.genetica ? <span className="block text-muted-foreground">{c.genetica}</span> : null}
                    </span>
                  </span>
                ) : e.numero === 1 ? (
                  <span className="mt-3 block font-serif text-[0.95rem] leading-snug text-muted-foreground">
                    {PRIMERA_RONDA}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </Riel>
  );
}
