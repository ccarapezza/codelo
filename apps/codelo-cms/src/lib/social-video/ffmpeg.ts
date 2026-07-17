// ffmpeg binary resolution. We deliberately do NOT depend on ffmpeg-static:
// its prebuilt binaries are glibc-only and break on our alpine (musl) runtime.
// Production installs ffmpeg via `apk add ffmpeg` (see Dockerfile); local dev
// needs a system ffmpeg (`apt/brew install ffmpeg`) or an FFMPEG_PATH override.
import { spawn } from "node:child_process";

export function resolveFfmpeg(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

let probed: boolean | undefined;

// One-shot availability probe (cached). Gates the Reel format in the Studio UI.
export async function probeFfmpeg(): Promise<boolean> {
  if (probed !== undefined) return probed;
  probed = await new Promise<boolean>((resolve) => {
    try {
      const p = spawn(resolveFfmpeg(), ["-version"], { stdio: "ignore" });
      p.on("error", () => resolve(false));
      p.on("close", (code) => resolve(code === 0));
    } catch {
      resolve(false);
    }
  });
  return probed;
}

// Run ffmpeg with args; rejects with the stderr tail on non-zero exit.
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(resolveFfmpeg(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d.toString();
      if (err.length > 8000) err = err.slice(-4000);
    });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}\n${err.slice(-1500)}`)),
    );
  });
}
