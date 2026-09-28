import { h, type SatoriNode } from "./hyperscript";
import { fireGradient, resolveBrand, rgba, type Brand, type Size } from "./brand";
import { bundledLogoMark } from "./assets";

const PAD = 96;

export type TemplateName = "hero" | "cover" | "stat" | "bullets" | "quote" | "countdown" | "cta";

export interface Slide {
  template: TemplateName;
  kicker?: string;
  title?: string;
  tagline?: string;
  hint?: string;
  logoSize?: number;
  titleSize?: number;
  big?: string | number;
  label?: string;
  numberSize?: number;
  labelSize?: number;
  items?: string[];
  text?: string;
  by?: string;
  size?: number;
  pre?: string;
  unit?: string;
  subtitle?: string;
  url?: string;
  bg?: { ai: string } | string;
  _bgUri?: string;
  // Render sin fondo opaco (PNG con alpha) para superponer la placa sobre un
  // clip de video con ffmpeg. Se le agrega un scrim para legibilidad.
  _transparent?: boolean;
}

// ---- piezas reutilizables -------------------------------------------------

function fireBar(width: number | string = 132): SatoriNode {
  return h("div", { style: { display: "flex", width, height: 14, borderRadius: 8, backgroundImage: fireGradient(marca) } });
}

function kicker(text?: string): SatoriNode | null {
  if (!text) return null;
  return h(
    "div",
    {
      style: {
        display: "flex",
        fontFamily: marca.fontBody,
        fontWeight: 700,
        fontSize: 30,
        letterSpacing: 6,
        textTransform: "uppercase",
        color: marca.accentLight,
      },
    },
    text,
  );
}

function footer(mode: "full" | "handle" | "none" = "full"): SatoriNode | null {
  if (mode === "none") return null;
  const handle = h(
    "div",
    { style: { display: "flex", fontFamily: marca.fontBody, fontWeight: 600, fontSize: 30, color: marca.muted } },
    handleActual ? "@" + handleActual : "",
  );

  if (mode === "handle") {
    return h("div", { style: { display: "flex", justifyContent: "center", width: "100%" } }, handle);
  }
  return h(
    "div",
    { style: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" } },
    h("img", { src: logoActual, style: { height: 64 } }),
    handle,
  );
}

interface FrameOpts {
  size: Size;
  children: unknown[];
  bgUri?: string;
  scrim?: number;
  justify?: string;
  tint?: string | null;
  center?: boolean;
  footerMode?: "full" | "handle" | "none";
  transparent?: boolean;
}

// marco base: fondo (color o imagen IA), scrim, contenido y footer
function frame({
  size,
  children,
  bgUri,
  scrim = 0.5,
  justify = "center",
  tint,
  center = false,
  footerMode = "full",
  transparent = false,
}: FrameOpts): SatoriNode {
  const layers: SatoriNode[] = [];

  // Modo transparente (overlay sobre video): sin fondo opaco, solo un scrim
  // de abajo hacia arriba para que el texto se lea sobre cualquier clip.
  if (transparent) {
    layers.push(
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          display: "flex",
          backgroundImage: `linear-gradient(180deg, ${rgba(marca.bg, 0.25)} 0%, ${rgba(marca.bg, 0.45)} 45%, ${rgba(marca.bg, 0.85)} 100%)`,
        },
      }),
    );
  } else {
    layers.push(
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          display: "flex",
          backgroundColor: marca.bg,
        },
      }),
    );
  }

  if (bgUri && !transparent) {
    layers.push(
      h("img", {
        src: bgUri,
        style: { position: "absolute", top: 0, left: 0, width: size.width, height: size.height, objectFit: "cover" },
      }),
    );
    layers.push(
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          display: "flex",
          backgroundImage: `linear-gradient(180deg, ${rgba(marca.bg, +(scrim * 0.65).toFixed(2))} 0%, ${rgba(marca.bg, +scrim.toFixed(2))} 50%, ${rgba(marca.bg, 0.97)} 100%)`,
        },
      }),
    );
  }

  if (tint) {
    layers.push(
      h("div", {
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          width: size.width,
          height: size.height,
          display: "flex",
          backgroundImage: `radial-gradient(120% 90% at 50% 18%, ${tint} 0%, ${rgba(marca.bg, 0)} 60%)`,
        },
      }),
    );
  }

  // barra de acento arriba
  layers.push(
    h("div", {
      style: { position: "absolute", top: 0, left: 0, width: size.width, height: 12, display: "flex", backgroundImage: fireGradient(marca) },
    }),
  );

  const content = h(
    "div",
    {
      style: {
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: justify,
        width: size.width,
        height: size.height,
        padding: PAD,
        boxSizing: "border-box",
      },
    },
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          justifyContent: justify,
          ...(center ? { alignItems: "center", textAlign: "center" } : {}),
        },
      },
      children,
    ),
    footer(footerMode),
  );

  return h(
    "div",
    {
      style: {
        display: "flex",
        position: "relative",
        width: size.width,
        height: size.height,
        fontFamily: marca.fontBody,
        color: marca.title,
        overflow: "hidden",
      },
    },
    ...layers,
    content,
  );
}

// ---- plantillas -----------------------------------------------------------

type TemplateFn = (slide: Slide, size: Size) => SatoriNode;

const templates: Record<TemplateName, TemplateFn> = {
  // Hero / bienvenida: el LOGO grande y centrado como protagonista.
  hero(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.62,
      justify: "center",
      center: true,
      footerMode: "handle",
      children: [
        slide.kicker
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  fontFamily: marca.fontBody,
                  fontWeight: 700,
                  fontSize: 34,
                  letterSpacing: 8,
                  textTransform: "uppercase",
                  color: marca.accentLight,
                  marginBottom: 18,
                },
              },
              slide.kicker,
            )
          : null,
        h("img", { src: logoActual, style: { width: slide.logoSize || 780 } }),
        slide.tagline
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  marginTop: 24,
                  fontSize: 40,
                  fontWeight: 600,
                  color: marca.body,
                  maxWidth: 860,
                  lineHeight: 1.2,
                  textAlign: "center",
                },
              },
              slide.tagline,
            )
          : null,
        h("div", { style: { display: "flex", marginTop: 34 } }, fireBar(160)),
        slide.hint
          ? h(
              "div",
              { style: { display: "flex", marginTop: 26, fontSize: 32, fontWeight: 600, color: marca.title } },
              slide.hint,
            )
          : null,
      ],
    });
  },

  // Portada de carrusel: kicker + título grande + pista "deslizá"
  cover(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.55,
      justify: "flex-end",
      children: [
        kicker(slide.kicker),
        h("div", { style: { display: "flex", height: 18 } }),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: marca.fontDisplay,
              fontSize: slide.titleSize || 132,
              lineHeight: 0.95,
              textTransform: "uppercase",
              letterSpacing: 1,
              maxWidth: "100%",
            },
          },
          slide.title,
        ),
        h("div", { style: { display: "flex", height: 28 } }),
        fireBar(),
        slide.hint
          ? h(
              "div",
              { style: { display: "flex", marginTop: 26, fontSize: 32, fontWeight: 600, color: marca.body } },
              slide.hint,
            )
          : null,
      ],
    });
  },

  // Dato fuerte: número gigante + etiqueta
  stat(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.6,
      justify: "center",
      tint: !slide._bgUri ? rgba(marca.accent, 0.16) : null,
      children: [
        kicker(slide.kicker),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: marca.fontDisplay,
              fontSize: slide.numberSize || 380,
              lineHeight: 0.9,
              color: marca.accentLight,
              letterSpacing: 2,
            },
          },
          String(slide.big),
        ),
        h("div", { style: { display: "flex", height: 18 } }),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontSize: slide.labelSize || 50,
              fontWeight: 600,
              color: marca.body,
              maxWidth: "92%",
              lineHeight: 1.15,
            },
          },
          slide.label,
        ),
      ],
    });
  },

  // Lista de puntos
  bullets(slide, size) {
    const items = (slide.items || []).map((it) =>
      h(
        "div",
        { style: { display: "flex", alignItems: "flex-start", marginBottom: 30 } },
        h("div", {
          style: { display: "flex", width: 14, height: 44, borderRadius: 6, backgroundImage: fireGradient(marca), marginRight: 26, marginTop: 6 },
        }),
        h(
          "div",
          { style: { display: "flex", fontSize: 44, fontWeight: 500, color: marca.body, lineHeight: 1.2, maxWidth: 760 } },
          it,
        ),
      ),
    );
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.62,
      justify: "center",
      children: [
        kicker(slide.kicker),
        slide.title
          ? h(
              "div",
              {
                style: {
                  display: "flex",
                  fontFamily: marca.fontDisplay,
                  fontSize: slide.titleSize || 84,
                  textTransform: "uppercase",
                  lineHeight: 1,
                  marginBottom: 48,
                  marginTop: 14,
                },
              },
              slide.title,
            )
          : null,
        h("div", { style: { display: "flex", flexDirection: "column" } }, ...items),
      ],
    });
  },

  // Frase / cita
  quote(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.6,
      justify: "center",
      children: [
        h("div", { style: { display: "flex", fontFamily: marca.fontDisplay, fontSize: 200, lineHeight: 0.7, color: marca.accentLight } }, "“"),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: marca.fontDisplay,
              fontSize: slide.size || 96,
              lineHeight: 1.02,
              textTransform: "uppercase",
              marginTop: 6,
            },
          },
          slide.text,
        ),
        slide.by
          ? h("div", { style: { display: "flex", marginTop: 34, fontSize: 34, fontWeight: 600, color: marca.muted } }, "— " + slide.by)
          : null,
      ],
    });
  },

  // Cuenta regresiva
  countdown(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.6,
      justify: "center",
      tint: !slide._bgUri ? rgba(marca.accentDeep, 0.18) : null,
      children: [
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: marca.fontBody,
              fontWeight: 700,
              fontSize: 56,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: marca.body,
            },
          },
          slide.pre || "Faltan",
        ),
        h("div", { style: { display: "flex", fontFamily: marca.fontDisplay, fontSize: 460, lineHeight: 0.85, color: marca.accentLight } }, String(slide.big)),
        h(
          "div",
          {
            style: {
              display: "flex",
              fontFamily: marca.fontBody,
              fontWeight: 700,
              fontSize: 56,
              letterSpacing: 10,
              textTransform: "uppercase",
              color: marca.body,
            },
          },
          slide.unit || "días",
        ),
        slide.label
          ? h(
              "div",
              { style: { display: "flex", marginTop: 30, fontSize: 40, fontWeight: 600, color: marca.title, textAlign: "center", maxWidth: "90%" } },
              slide.label,
            )
          : null,
      ],
    });
  },

  // Cierre / llamado a la acción
  cta(slide, size) {
    return frame({
      size,
      bgUri: slide._bgUri,
      transparent: slide._transparent,
      scrim: 0.55,
      justify: "center",
      tint: !slide._bgUri ? rgba(marca.accent, 0.18) : null,
      children: [
        slide.title
          ? h(
              "div",
              {
                style: { display: "flex", fontFamily: marca.fontDisplay, fontSize: slide.titleSize || 92, textTransform: "uppercase", lineHeight: 1, marginBottom: 24 },
              },
              slide.title,
            )
          : null,
        slide.subtitle
          ? h(
              "div",
              { style: { display: "flex", fontSize: 42, fontWeight: 500, color: marca.body, marginBottom: 40, maxWidth: "92%", lineHeight: 1.2 } },
              slide.subtitle,
            )
          : null,
        fireBar(180),
        h("div", { style: { display: "flex", marginTop: 44, fontFamily: marca.fontDisplay, fontSize: 96, color: marca.title } }, handleActual ? "@" + handleActual : ""),
        h("div", { style: { display: "flex", marginTop: 8, fontSize: 38, fontWeight: 600, color: marca.accentLight } }, slide.url || handleActual),
      ],
    });
  },
};

// La subset "latin" de las fuentes no trae flechas/emojis. Mapeamos lo común
// para evitar el "tofu" (caja vacía). Para emojis, usalos en el caption.
function clean<T>(v: T): T {
  if (typeof v === "string") return v.replace(/[→➜➡⇒]/g, "»").replace(/[←]/g, "«") as unknown as T;
  if (Array.isArray(v)) return v.map((x) => clean(x)) as unknown as T;
  return v;
}

const TEXT_FIELDS: (keyof Slide)[] = ["kicker", "title", "tagline", "hint", "label", "subtitle", "text", "by", "pre", "unit", "url", "items"];

export const TEMPLATE_NAMES: TemplateName[] = Object.keys(templates) as TemplateName[];

/**
 * Lo que la instalación aporta al render en curso: su marca, su logo y su
 * `@handle`.
 *
 * Ninguna de las tres es una constante del motor. Los colores y el logo salen
 * de `site-setting` (Identidad visual) y el handle de `socialHandle`, que
 * además comparte con el caption: si el render leyera uno y el caption otro, la
 * placa y el texto que la acompaña firmarían distinto.
 *
 * Se guardan en módulo y no se pasan por parámetro porque habría que
 * enhebrarlos por las diez funciones de plantilla. Es seguro porque satori
 * renderiza de forma SINCRÓNICA: `renderSlide` arma el árbol entero antes de
 * devolver, así que no hay dos renders intercalados pisándose la marca. Si
 * alguna vez una plantilla se vuelve asíncrona, esto deja de valer y hay que
 * enhebrar de verdad.
 */
export interface RenderContext {
  /** Sin el `@`. Vacío = no se imprime el pie. */
  handle?: string;
  /** Sin esto se dibuja con los colores del motor. */
  brand?: Brand;
  /** Data URI del logo subido. Sin esto, el bundleado. */
  logo?: string | null;
}

let handleActual = "";
// `resolveBrand(null)` es la marca del motor: no repetimos los nombres de
// fuente acá, que ya viven en la costura.
let marca: Brand = resolveBrand(null);
let logoActual = "";

export function renderSlide(slide: Slide, size: Size, ctx: RenderContext = {}): SatoriNode {
  handleActual = ctx.handle ?? "";
  if (ctx.brand) marca = ctx.brand;
  logoActual = ctx.logo || bundledLogoMark();
  const fn = templates[slide.template];
  if (!fn) {
    throw new Error(`Plantilla desconocida: "${slide.template}". Disponibles: ${TEMPLATE_NAMES.join(", ")}`);
  }
  const safe: Slide = { ...slide };
  for (const field of TEXT_FIELDS) {
    if (field in safe && safe[field] != null) {
      (safe as unknown as Record<string, unknown>)[field] = clean(safe[field]);
    }
  }
  return fn(safe, size);
}
