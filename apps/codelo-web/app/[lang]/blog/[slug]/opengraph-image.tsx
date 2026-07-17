import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/cms";
import { logoDataUri } from "@/lib/og-assets";
import { SITE_URL } from "@/lib/seo";

export const alt = "Nota — Fulbo Studio";
// 600×315 (1.91:1, same ratio as the 1200×630 standard). next/og only emits
// PNG, and a PNG of a full-bleed *photo* at 1200×630 weighs ~950 KB — well over
// WhatsApp's ~300 KB preview ceiling, so the thumbnail silently failed to show.
// Halving each dimension quarters the pixel count (and the file size, ~230 KB),
// landing safely under the limit. The design constants below are scaled to
// match, so the card looks identical — just at half resolution. (A full-res fix
// would require JPEG output via sharp, which the alpine standalone build makes
// risky; revisit if FB/Twitter large-card sharpness becomes a concern.)
export const size = { width: 600, height: 315 };
export const contentType = "image/png";
// Cache the generated image so crawlers (WhatsApp/Meta) get it instantly on
// repeat fetches instead of regenerating (~1.5s) and risking their timeout.
export const revalidate = 3600;

// Fetch a remote image (the Strapi cover) and inline it as a data URI so satori
// can embed it. Relative `/cms/...` URLs are resolved against the site origin.
async function remoteDataUri(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const abs = url.startsWith("http") ? url : `${SITE_URL}${url}`;
    const res = await fetch(abs);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "image/png";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const post = await getPostBySlug(slug, lang === "en" ? "en" : "es").catch(() => null);
  const title = post?.title ?? "Cogollos del Oeste";
  const [cover, logo] = await Promise.all([
    remoteDataUri(post?.coverImage?.url),
    logoDataUri(),
  ]);
  const eyebrow = lang === "en" ? "Nota · Cogollos del Oeste" : "Nota · Cogollos del Oeste";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: "#07120c",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        {/* Strong bottom-up scrim: photo readable on top, title legible below,
            and the large dark area keeps the PNG well under WhatsApp's ~300KB. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "linear-gradient(0deg, rgba(7,18,12,0.97) 0%, rgba(7,18,12,0.86) 32%, rgba(7,18,12,0.5) 66%, rgba(7,18,12,0.28) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 4,
            display: "flex",
            backgroundImage: "linear-gradient(90deg, transparent 0%, #16a34a 50%, transparent 100%)",
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            height: "100%",
            width: "100%",
            padding: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 12,
              fontWeight: 700,
              color: "#16a34a",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 7,
            }}
          >
            {eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, lineHeight: 1.05, maxWidth: 500 }}>
            {title}
          </div>
        </div>
        {logo ? (
          <img src={logo} alt="" width={52} height={47} style={{ position: "absolute", top: 22, right: 28 }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 36,
            display: "flex",
            fontSize: 10,
            fontWeight: 600,
            color: "#a3b3a8",
            letterSpacing: "0.32em",
          }}
        >
          FULBO.STUDIO
        </div>
      </div>
    ),
    { ...size },
  );
}
