"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Material, TipoObjeto } from "@/lib/vertical/copa-cata/tipos";
import { cn } from "@/lib/utils";
import { inclinacion } from "./inclinacion";
import { Lightbox, type EtiquetasLightbox, type ItemLightbox } from "./Lightbox";

export type ItemObjeto = ItemLightbox & {
  tipo: TipoObjeto;
  material: Material;
  /** Lo que se lee debajo: el tipo y, si hace falta, cuál ("Credencial · Socio participante"). */
  rotulo: string;
};

export type EtiquetasObjetos = EtiquetasLightbox & {
  /** Nombre de la lista para lectores de pantalla. */
  lista: string;
};

/**
 * El ancho de cada objeto en la mesa. Van más o menos a escala entre sí (la
 * credencial mide 81 mm; la entrada, 135; la ficha, una hoja) salvo la ficha,
 * que a escala taparía al resto. En el teléfono las credenciales entran de a
 * dos; entre 1024 y 1279 px todo se achica un poco para que la edición más
 * cargada (2021, cuatro objetos) entre en una fila y no deje uno solo abajo.
 */
const ANCHO: Record<TipoObjeto, string> = {
  credencial: "w-[9rem] sm:w-[13.5rem] xl:w-[15rem]",
  entrada: "w-full max-w-[24rem] lg:max-w-[20rem] xl:max-w-[24rem]",
  sticker: "w-[10rem] sm:w-[12rem]",
  rotulo: "w-[12rem] sm:w-[14rem] lg:w-[12rem] xl:w-[14rem]",
  "ficha-cata": "w-[12.5rem] sm:w-[16rem]",
  "etiqueta-premio": "w-[8.75rem] sm:w-[11rem] lg:w-[9.5rem] xl:w-[11rem]",
};

/**
 * El formato que manda en el ancho: el del tipo, salvo la credencial apaisada
 * (2022), que no cuelga: es una tarjeta de papel del tamaño de una entrada.
 */
function formato(item: Pick<ItemObjeto, "tipo" | "width" | "height">): TipoObjeto {
  return item.tipo === "credencial" && item.width > item.height ? "entrada" : item.tipo;
}

/** El ancho que pide `next/image`, según las filas de ANCHO. */
const TAMANIO: Record<TipoObjeto, string> = {
  credencial: "(min-width: 1280px) 240px, (min-width: 640px) 216px, 144px",
  entrada: "(min-width: 1280px) 384px, (min-width: 1024px) 320px, (min-width: 640px) 384px, 100vw",
  sticker: "(min-width: 640px) 192px, 160px",
  rotulo: "(min-width: 1280px) 224px, (min-width: 1024px) 192px, (min-width: 640px) 224px, 192px",
  "ficha-cata": "(min-width: 640px) 256px, 200px",
  "etiqueta-premio": "(min-width: 1280px) 176px, (min-width: 1024px) 152px, (min-width: 640px) 176px, 140px",
};

/**
 * La pose de reposo de cada objeto, en orden, para que no cuelguen ni floten
 * todos igual. Es también su pose con movimiento reducido: quietos y apenas
 * inclinados.
 */
const POSES = [
  { rx: 3, ry: -8, rz: -1.2 },
  { rx: 2, ry: 7, rz: 1 },
  { rx: 4, ry: -5, rz: 0.7 },
  { rx: 2, ry: 9, rz: -0.8 },
] as const;

/**
 * Los objetos de una edición que pasaron de mano en mano —credenciales,
 * entradas, stickers, rótulos, fichas, etiquetas de premio— dibujados como
 * cosas: cuelgan o flotan en la noche, se inclinan con el puntero y les corre
 * el brillo de su material. Cada uno abre el visor de la sección para leerlo
 * plano y grande; al cerrar, el foco vuelve al objeto que se estaba viendo.
 *
 * El movimiento es CSS (`.objeto*` en vertical.css): esto solo escribe cuatro
 * variables en el objeto mientras el mouse está encima.
 */
export function Objetos({ items, etiquetas }: { items: readonly ItemObjeto[]; etiquetas: EtiquetasObjetos }) {
  const [indice, setIndice] = useState<number | null>(null);
  const botones = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <>
      <ul
        aria-label={etiquetas.lista}
        className="flex flex-wrap items-center justify-center gap-x-5 gap-y-14 sm:gap-x-12 lg:gap-x-8 xl:gap-x-16"
      >
        {items.map((item, i) => (
          <li key={item.src} className={cn(ANCHO[formato(item)], item.material === "plastico" && "pt-20 sm:pt-24")}>
            <Objeto
              item={item}
              orden={i}
              registrar={(el) => {
                botones.current[i] = el;
              }}
              onAbrir={() => setIndice(i)}
            />
          </li>
        ))}
      </ul>
      <Lightbox
        items={items}
        indice={indice}
        onCambiar={setIndice}
        onCerrar={() => setIndice(null)}
        onDevolverFoco={(i) => botones.current[i]?.focus()}
        etiquetas={etiquetas}
      />
    </>
  );
}

function Objeto({
  item,
  orden,
  registrar,
  onAbrir,
}: {
  item: ItemObjeto;
  orden: number;
  registrar: (el: HTMLButtonElement | null) => void;
  onAbrir: () => void;
}) {
  const { escena, eventos } = useInclinacion<HTMLButtonElement>();
  return (
    <button
      type="button"
      ref={registrar}
      aria-haspopup="dialog"
      onClick={onAbrir}
      {...eventos}
      data-material={item.material}
      data-tipo={item.tipo}
      className="objeto group block w-full"
      style={estiloPose(orden)}
    >
      <CuerpoObjeto item={item} escena={escena} tamanio={TAMANIO[formato(item)]} />
      <span className="label mt-5 block text-center text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
        {item.rotulo}
      </span>
    </button>
  );
}

/**
 * Un objeto que lleva a otra página en vez de abrir el visor: la credencial de
 * la 1ª Copa que cuelga junto al manifiesto de la portada y entra a su edición.
 */
export function ObjetoEnlace({
  item,
  href,
  tamanio,
  className,
}: {
  item: ItemObjeto;
  href: string;
  /** El `sizes` de la imagen, según el ancho que le dé quien lo usa. */
  tamanio: string;
  className?: string;
}) {
  const { escena, eventos } = useInclinacion<HTMLAnchorElement>();
  return (
    <Link
      href={href}
      {...eventos}
      data-material={item.material}
      data-tipo={item.tipo}
      className={cn("objeto group", className)}
      style={estiloPose(1)}
    >
      <CuerpoObjeto item={item} escena={escena} tamanio={tamanio} />
      <span className="label mt-5 block text-center text-(--ember-texto) underline-offset-4 group-hover:underline">
        {item.rotulo}
      </span>
    </Link>
  );
}

/** La pieza con sus capas (ver el bloque de objetos en vertical.css). */
function CuerpoObjeto({
  item,
  escena,
  tamanio,
}: {
  item: ItemObjeto;
  escena: React.RefObject<HTMLSpanElement | null>;
  tamanio: string;
}) {
  const plastico = item.material === "plastico";
  return (
    <span ref={escena} className="objeto-escena">
      <span className="objeto-vaiven">
        {plastico ? <span aria-hidden className="objeto-cordon" /> : null}
        <span className="objeto-inclina">
          <span className="objeto-pieza">
            <Image
              src={item.src}
              alt={item.alt}
              width={item.width}
              height={item.height}
              sizes={tamanio}
              className="objeto-img"
            />
            <span aria-hidden className="objeto-luz">
              <span className="objeto-brillo" />
            </span>
            {plastico ? (
              <>
                <span aria-hidden className="objeto-ranura" />
                <span aria-hidden className="objeto-gancho" />
              </>
            ) : null}
          </span>
        </span>
      </span>
    </span>
  );
}

/** La pose de reposo y el compás del vaivén, distintos según el lugar en la fila. */
function estiloPose(orden: number): React.CSSProperties {
  const pose = POSES[orden % POSES.length];
  return {
    "--pose-rx": `${pose.rx}deg`,
    "--pose-ry": `${pose.ry}deg`,
    "--pose-rz": `${pose.rz}deg`,
    // Duraciones y desfasajes distintos: que no se muevan al unísono.
    "--vaiven-dur": `${(6.2 + (orden % 3) * 0.9).toFixed(1)}s`,
    "--vaiven-desfasaje": `${(-1.7 * orden).toFixed(1)}s`,
  } as React.CSSProperties;
}

const VARIABLES = ["--rx", "--ry", "--gx", "--gy"] as const;

/** Si el sistema pide movimiento reducido. Sin `matchMedia` (jsdom), no. */
const quieto = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * La inclinación que sigue al puntero. Devuelve la referencia de la escena —lo
 * que se mide, porque no se transforma: medir el objeto inclinado haría
 * temblar la cuenta— y los eventos para el elemento que recibe las variables.
 *
 * Solo el mouse y el lápiz inclinan: con el dedo, arrastrar es desplazar la
 * página, y el objeto ya se mueve solo. Con movimiento reducido, nada.
 */
function useInclinacion<T extends HTMLElement>() {
  const escena = useRef<HTMLSpanElement>(null);
  const cuadro = useRef<number | null>(null);
  const punto = useRef<{ x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (cuadro.current !== null) cancelAnimationFrame(cuadro.current);
    },
    [],
  );

  const seguir = (e: React.PointerEvent<T>) => {
    if (e.pointerType === "touch" || quieto()) return;
    const el = e.currentTarget;
    punto.current = { x: e.clientX, y: e.clientY };
    el.dataset.siguiendo = "";
    if (cuadro.current !== null) return;
    // Una escritura por cuadro, por más eventos que lleguen.
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = null;
      const p = punto.current;
      if (!p || !escena.current) return;
      const { rx, ry, gx, gy } = inclinacion(p, escena.current.getBoundingClientRect());
      el.style.setProperty("--rx", `${rx}deg`);
      el.style.setProperty("--ry", `${ry}deg`);
      el.style.setProperty("--gx", String(gx));
      el.style.setProperty("--gy", String(gy));
    });
  };

  // Al salir se borran las variables: vuelven las de la hoja de estilos (el
  // reposo, o la pose del foco) y la transición lo lleva de vuelta.
  const soltar = (e: React.PointerEvent<T>) => {
    const el = e.currentTarget;
    punto.current = null;
    if (cuadro.current !== null) {
      cancelAnimationFrame(cuadro.current);
      cuadro.current = null;
    }
    delete el.dataset.siguiendo;
    for (const v of VARIABLES) el.style.removeProperty(v);
  };

  return { escena, eventos: { onPointerMove: seguir, onPointerLeave: soltar, onPointerCancel: soltar } };
}
