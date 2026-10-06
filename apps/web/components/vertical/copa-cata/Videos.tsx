import { getTranslations } from "next-intl/server";
import { Riel } from "./Riel";
import { VideoClip, type Video } from "./VideoClip";

/** Los videos de una edición, en un riel: casi todos son verticales (historias y reels). */
export async function Videos({ videos }: { videos: readonly Video[] }) {
  const t = await getTranslations("copa");
  return (
    <Riel etiqueta={t("secciones.videos")} anterior={t("riel.anterior")} siguiente={t("riel.siguiente")}>
      {videos.map((v) => (
        <li key={v.id} className="w-[min(62vw,15rem)] sm:w-60">
          <VideoClip video={v} />
        </li>
      ))}
    </Riel>
  );
}
