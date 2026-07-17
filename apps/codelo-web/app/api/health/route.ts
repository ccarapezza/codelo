import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lightweight liveness/readiness probe used by Caddy and Docker healthchecks.
// This app has no database of its own — content comes from the CMS — so the
// probe reports CMS reachability without failing the whole check (the site
// still serves cached content when the CMS is briefly down).
export async function GET() {
  const cmsBase = (process.env.NEXT_PUBLIC_CMS_URL ?? "").replace(/\/$/, "");
  let cms: "ok" | "down" | "unconfigured" = "unconfigured";
  if (cmsBase) {
    try {
      const res = await fetch(`${cmsBase}/_health`, {
        cache: "no-store",
        signal: AbortSignal.timeout(2000),
      });
      cms = res.ok ? "ok" : "down";
    } catch {
      cms = "down";
    }
  }
  return NextResponse.json({ status: "ok", cms }, { headers: { "cache-control": "no-store" } });
}
