// Final reel composition with ffmpeg: AI background clip (looped/trimmed,
// scaled+cropped to the exact canvas) + transparent overlay PNG on top →
// H.264 yuv420p +faststart (Instagram-safe). NO audio (`-an`): native model
// audio renders poorly and IG uses its own audio at publish time.
import { runFfmpeg } from "./ffmpeg";

export interface ComposeReelOptions {
  clip: string;
  overlay: string;
  out: string;
  seconds: number;
  width?: number;
  height?: number;
  fps?: number;
}

export async function composeReel({
  clip,
  overlay,
  out,
  seconds,
  width = 1080,
  height = 1920,
  fps = 30,
}: ComposeReelOptions): Promise<string> {
  const vf =
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${height},setsar=1,fps=${fps}[bg];` +
    `[bg][1:v]overlay=0:0:format=auto[v]`;

  await runFfmpeg([
    "-y",
    "-stream_loop", "-1", "-i", clip,
    "-loop", "1", "-i", overlay,
    "-filter_complex", vf,
    "-map", "[v]",
    "-an",
    "-t", String(seconds),
    "-r", String(fps),
    // crf 24 + cap de bitrate: el clip IA es muy detallado y a crf 20 salía a
    // ~15 Mbps (7.7MB por 4s). Esto lo deja en ~2-3 Mbps, peso apto para IG y
    // para reproducir/descargar rápido, sin pérdida visible.
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "24",
    "-maxrate", "3500k", "-bufsize", "7000k",
    "-movflags", "+faststart",
    out,
  ]);
  return out;
}
