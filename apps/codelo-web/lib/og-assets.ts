// Server-only helpers for dynamic OG images (next/og). Reads local image assets
// from /public and returns base64 data URIs (satori embeds these directly).
import fs from "node:fs/promises";
import path from "node:path";

const pub = (...segs: string[]) => path.join(process.cwd(), "public", ...segs);

async function fileDataUri(absPath: string, mime = "image/png"): Promise<string | null> {
  try {
    const buf = await fs.readFile(absPath);
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

// Site logo for OG cards. Returns null until real branding assets exist —
// callers must render a text wordmark fallback.
export function logoDataUri(): Promise<string | null> {
  return fileDataUri(pub("logo", "codelo.png"));
}
