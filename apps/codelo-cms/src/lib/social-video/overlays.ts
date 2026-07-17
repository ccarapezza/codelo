// Transparent text overlays for reels (1080x1920). Rendered with satori →
// PNG with alpha (resvg preserves transparency) and composited over the AI
// background clip with ffmpeg. Legibility over arbitrary video is guaranteed
// structurally: bottom scrim + radial scrim behind the text block + textShadow.
import { h, type SatoriNode } from "../social-cards/hyperscript";
import { BRAND, FIRE, type Size } from "../social-cards/brand";
import { logoMark } from "../social-cards/assets";

export type OverlayType = "title" | "countdown";

export interface CountdownOverlayFields {
  pre?: string;
  big: string;
  unit?: string;
  label?: string;
}

export interface TitleOverlayFields {
  kicker?: string;
  title: string;
  titleSize?: number;
}

const SHADOW = "0 3px 18px rgba(0,0,0,0.7)";

function topBar(width: number): SatoriNode {
  return h("div", {
    style: { position: "absolute", top: 0, left: 0, width, height: 12, display: "flex", backgroundImage: FIRE },
  });
}

function bottomScrim(width: number, height: number, from = "32%"): SatoriNode {
  return h("div", {
    style: {
      position: "absolute", top: 0, left: 0, width, height, display: "flex",
      backgroundImage: `linear-gradient(180deg, rgba(8,11,9,0) ${from}, rgba(8,11,9,0.50) 72%, rgba(8,11,9,0.86) 100%)`,
    },
  });
}

function footer(width: number): SatoriNode {
  return h(
    "div",
    {
      style: {
        position: "absolute", bottom: 76, left: 0, width, display: "flex",
        alignItems: "center", justifyContent: "center",
      },
    },
    h("img", { src: logoMark(), style: { height: 60, marginRight: 18 } }),
    h(
      "div",
      { style: { display: "flex", fontFamily: BRAND.fontBody, fontWeight: 600, fontSize: 36, color: BRAND.white } },
      "@" + BRAND.handle,
    ),
  );
}

function root(size: Size, ...layers: unknown[]): SatoriNode {
  return h(
    "div",
    {
      style: {
        display: "flex", position: "relative", width: size.width, height: size.height,
        fontFamily: BRAND.fontBody, color: BRAND.white, overflow: "hidden",
      },
    },
    ...layers,
  );
}

// Countdown hype: "Faltan / 8 / días / para el Mundial 2026".
export function countdownOverlay(o: CountdownOverlayFields, size: Size): SatoriNode {
  const { width, height } = size;

  // Radial scrim centered on the text block: keeps FALTAN/DÍAS readable even
  // over bright smoke/pyro in the middle of the clip.
  const centerScrim = h("div", {
    style: {
      position: "absolute", top: 0, left: 0, width, height, display: "flex",
      backgroundImage:
        "radial-gradient(62% 40% at 50% 46%, rgba(8,11,9,0.80) 0%, rgba(8,11,9,0.45) 55%, rgba(8,11,9,0) 82%)",
    },
  });

  const capsLabel = (text: string): SatoriNode =>
    h(
      "div",
      {
        style: {
          display: "flex", fontFamily: BRAND.fontBody, fontWeight: 700, fontSize: 60,
          letterSpacing: 12, textTransform: "uppercase", color: BRAND.offwhite, textShadow: SHADOW,
        },
      },
      text,
    );

  const content = h(
    "div",
    {
      style: {
        position: "relative", display: "flex", flexDirection: "column",
        justifyContent: "center", alignItems: "center", textAlign: "center",
        width, height, padding: 96, boxSizing: "border-box",
      },
    },
    capsLabel(o.pre || "Faltan"),
    h(
      "div",
      {
        style: {
          display: "flex", fontFamily: BRAND.fontDisplay, fontSize: 520, lineHeight: 0.82,
          color: BRAND.flame, letterSpacing: 2,
        },
      },
      String(o.big),
    ),
    capsLabel(o.unit || "días"),
    o.label
      ? h(
          "div",
          {
            style: {
              display: "flex", marginTop: 36, fontSize: 46, fontWeight: 600,
              color: BRAND.white, maxWidth: "88%", lineHeight: 1.15, textShadow: SHADOW,
            },
          },
          o.label,
        )
      : null,
    h(
      "div",
      { style: { display: "flex", marginTop: 56 } },
      h("div", { style: { display: "flex", width: 200, height: 14, borderRadius: 8, backgroundImage: FIRE } }),
    ),
  );

  return root(size, bottomScrim(width, height), centerScrim, topBar(width), content, footer(width));
}

// Nota promo: kicker + big uppercase title anchored to the bottom (cover-style).
export function titleOverlay(o: TitleOverlayFields, size: Size): SatoriNode {
  const { width, height } = size;

  const content = h(
    "div",
    {
      style: {
        position: "relative", display: "flex", flexDirection: "column",
        justifyContent: "flex-end", width, height,
        padding: 96, paddingBottom: 220, boxSizing: "border-box",
      },
    },
    o.kicker
      ? h(
          "div",
          {
            style: {
              display: "flex", fontFamily: BRAND.fontBody, fontWeight: 700, fontSize: 34,
              letterSpacing: 8, textTransform: "uppercase", color: BRAND.orange,
              marginBottom: 22, textShadow: SHADOW,
            },
          },
          o.kicker,
        )
      : null,
    h(
      "div",
      {
        style: {
          display: "flex", fontFamily: BRAND.fontDisplay, fontSize: o.titleSize || 124,
          lineHeight: 0.98, textTransform: "uppercase", letterSpacing: 1, maxWidth: "100%",
          color: BRAND.white, textShadow: SHADOW,
        },
      },
      o.title,
    ),
    h(
      "div",
      { style: { display: "flex", marginTop: 32 } },
      h("div", { style: { display: "flex", width: 160, height: 14, borderRadius: 8, backgroundImage: FIRE } }),
    ),
  );

  // Stronger/lower scrim than countdown: the text hugs the bottom third.
  const scrim = h("div", {
    style: {
      position: "absolute", top: 0, left: 0, width, height, display: "flex",
      backgroundImage:
        "linear-gradient(180deg, rgba(8,11,9,0) 38%, rgba(8,11,9,0.55) 70%, rgba(8,11,9,0.92) 100%)",
    },
  });

  return root(size, scrim, topBar(width), content, footer(width));
}

export function renderOverlayNode(
  type: OverlayType,
  fields: Record<string, string>,
  size: Size,
): SatoriNode {
  if (type === "countdown") {
    return countdownOverlay(
      { pre: fields.pre, big: fields.big ?? "?", unit: fields.unit, label: fields.label },
      size,
    );
  }
  return titleOverlay({ kicker: fields.kicker, title: fields.title ?? "" }, size);
}
