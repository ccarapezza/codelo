import { getTranslations } from "next-intl/server";
import { formatDuracion, type Medio } from "@/lib/vertical/copa-cata";

export type Video = Extract<Medio, { tipo: "video" }>;

/**
 * La URL con que el navegador pide un video. Hoy es la de la biblioteca de
 * medios a través del proxy `/cms` (mismo origen: la CSP del motor no tiene
 * `media-src`, así que un video de otro origen no carga).
 *
 * Es el ÚNICO lugar que la arma. Si el proxy no devuelve 206 con
 * `Content-Range` —sin eso Safari e iOS no reproducen—, el plan B es un route
 * handler de la ruta (copa-cata/video/[archivo]) que reenvíe `Range` al CMS, y
 * el cambio es solo acá.
 */
export function urlDeVideo(url: Video["url"]): string {
  return url;
}

/**
 * Un video completo, sin autoplay ni loop: no carga nada hasta que alguien
 * aprieta play (`preload="none"`) y el póster ocupa su lugar mientras tanto.
 * Va en su proporción (los reels e historias, 9:16).
 */
export async function VideoClip({ video }: { video: Video }) {
  const t = await getTranslations("copa.videos");
  return (
    <figure className="m-0">
      <video
        controls
        preload="none"
        playsInline
        poster={video.poster}
        width={video.width}
        height={video.height}
        aria-label={video.alt}
        className="block h-auto w-full rounded-lg bg-(--brand-ink)"
        style={{ aspectRatio: `${video.width} / ${video.height}` }}
      >
        <source src={urlDeVideo(video.url)} type="video/mp4" />
      </video>
      <figcaption className="mt-3 px-0.5">
        <p className="label text-(--ember-texto) tabular-nums">
          {t(video.origen)} · {formatDuracion(video.duracion)}
        </p>
        <p className="mt-1.5 font-serif text-sm leading-snug text-muted-foreground">{video.alt}</p>
      </figcaption>
    </figure>
  );
}
