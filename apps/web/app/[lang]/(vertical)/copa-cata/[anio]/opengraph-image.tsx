import { ImageResponse } from "next/og";
import { anioDeParam, formatFecha, getEdicion } from "@/lib/vertical/copa-cata";
import { ilustracionOgDataUri } from "@/lib/vertical/copa-cata/og";
import { logoDataUri } from "@/lib/og-assets";
import { OG_CARD } from "@/lib/site";
import { SITE_NAME } from "@/lib/seo";

// Tarjeta de cada edición, con el patrón de blog/[slug]/opengraph-image.tsx:
// 600×315 (la mitad de 1200×630, misma proporción) porque next/og solo emite
// PNG y una imagen a sangre de 1200×630 pasa los ~300 KB que acepta WhatsApp.
// La noche de la sección, con la ilustración de la edición a la derecha y el
// año enorme a la izquierda, como el encabezado de la página.
export const alt = `Copa Cata del Oeste — ${SITE_NAME}`;
export const size = { width: 600, height: 315 };
export const contentType = "image/png";
export const revalidate = 3600;

const { sun: SUN, paper: PAPER } = OG_CARD;
/** La noche de la sección (vertical.css, bloque NOCHE). */
const NOCHE = "#040a2a";
/** El gris cálido de la sección sobre la noche: 9,6:1. */
const GRIS = "#c3b59f";

export default async function Image({ params }: { params: Promise<{ lang: string; anio: string }> }) {
  const { anio: param } = await params;
  const anio = anioDeParam(param);
  const edicion = anio ? getEdicion(anio) : null;
  const [arte, logo] = await Promise.all([anio ? ilustracionOgDataUri(anio) : null, logoDataUri()]);

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
            width={252}
            height={315}
            style={{ position: "absolute", top: 0, right: 0, width: 252, height: 315 }}
          />
        ) : null}
        {/* La ilustración se funde con la noche hacia el texto. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 172,
            width: 80,
            height: 315,
            display: "flex",
            backgroundImage: `linear-gradient(90deg, ${NOCHE} 0%, rgba(4,10,42,0) 100%)`,
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
            width: 360,
            padding: "28px 0 30px 34px",
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
              Copa Cata del Oeste
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 112,
                fontWeight: 800,
                lineHeight: 0.92,
                letterSpacing: "-0.04em",
                marginTop: 6,
              }}
            >
              {anio ? String(anio) : "Copa"}
            </div>
            {edicion ? (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
                <div style={{ display: "flex", fontSize: 18, fontWeight: 700, lineHeight: 1.2 }}>{edicion.nombre}</div>
                <div style={{ display: "flex", fontSize: 14, marginTop: 4, color: GRIS }}>
                  {formatFecha(edicion.fecha)}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
