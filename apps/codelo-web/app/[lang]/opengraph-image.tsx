import { ImageResponse } from "next/og";
import { logoDataUri } from "@/lib/og-assets";
import { SITE_NAME } from "@/lib/seo";

// Card OG por defecto: aplica a toda página que no declare la suya (las notas
// del blog tienen su propia card en blog/[slug]/opengraph-image.tsx). Es color
// plano en la paleta Dos Tintas, así que el PNG queda muy por debajo del techo
// de ~300 KB de WhatsApp incluso a resolución estándar.
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

// Paleta muestreada del logo (ver MASTER.md): tinta azul-negra, sol ámbar,
// papel. Constantes de marca — no siguen al tema.
const INK = "#00001C";
const SUN = "#E4B569";
const PAPER = "#F6E6CC";

export default async function Image() {
  const logo = await logoDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: PAPER,
          color: INK,
          fontFamily: "sans-serif",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", width: "100%", height: 8, backgroundColor: SUN }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            flexGrow: 1,
          }}
        >
          {logo ? (
            <img src={logo} alt="" width={140} height={140} style={{ marginBottom: 36 }} />
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: "0.3em",
              textTransform: "uppercase",
              color: INK,
              opacity: 0.7,
              marginBottom: 16,
            }}
          >
            Asociación civil · Oeste de CABA
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              maxWidth: 950,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 900,
              marginTop: 28,
              color: INK,
              opacity: 0.75,
            }}
          >
            Etnobotánica, derechos humanos, reducción de daños y ambiente.
          </div>
        </div>
        <div style={{ display: "flex", width: "100%", height: 8, backgroundColor: SUN, marginTop: 48 }} />
      </div>
    ),
    { ...size },
  );
}
