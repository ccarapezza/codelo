import { ImageResponse } from "next/og";
import { EDICIONES, PREMIOS, enNumeros } from "@/lib/vertical/copa-cata";
import { ilustracionOgDataUri } from "@/lib/vertical/copa-cata/og";
import { cejaPortada } from "@/lib/vertical/copa-cata/textos";
import { logoDataUri } from "@/lib/og-assets";
import { OG_CARD } from "@/lib/site";
import { SITE_NAME } from "@/lib/seo";

// Tarjeta de la portada de la Copa, con el patrón de la de cada edición:
// 600×315 en PNG, por el techo de ~300 KB de WhatsApp. La ilustración de la
// portada a sangre, con un velo de noche a la izquierda para el título.
export const alt = `Copa Cata del Oeste — ${SITE_NAME}`;
export const size = { width: 600, height: 315 };
export const contentType = "image/png";
export const revalidate = 3600;

const { sun: SUN, paper: PAPER } = OG_CARD;
/** La noche de la sección (vertical.css, bloque NOCHE). */
const NOCHE = "#040a2a";
const GRIS = "#c3b59f";

export default async function Image() {
  const numeros = enNumeros(EDICIONES, PREMIOS);
  const [arte, logo] = await Promise.all([ilustracionOgDataUri("portada"), logoDataUri()]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: NOCHE,
          color: PAPER,
          fontFamily: "sans-serif",
        }}
      >
        {arte ? (
          <img
            src={arte}
            alt=""
            width={600}
            height={315}
            style={{ position: "absolute", top: 0, left: 0, width: 600, height: 315 }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            backgroundImage:
              "linear-gradient(90deg, rgba(4,10,42,0.97) 0%, rgba(4,10,42,0.92) 38%, rgba(4,10,42,0.4) 64%, rgba(4,10,42,0) 84%)",
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
            backgroundImage: `linear-gradient(90deg, transparent 0%, ${SUN} 45%, transparent 100%)`,
          }}
        />
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            width: 330,
            padding: "28px 0 32px 34px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {logo ? <img src={logo} alt="" width={30} height={27} /> : null}
            <div style={{ display: "flex", fontSize: 10, fontWeight: 600, letterSpacing: "0.3em", color: GRIS }}>
              {SITE_NAME.toUpperCase()}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", flexGrow: 1 }}>
            <div
              style={{
                display: "flex",
                fontSize: 12,
                fontWeight: 700,
                color: SUN,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {cejaPortada(numeros.ediciones, numeros.desde, numeros.hasta)}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 50,
                fontWeight: 800,
                lineHeight: 0.98,
                letterSpacing: "-0.02em",
                marginTop: 10,
              }}
            >
              Copa Cata del Oeste
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
