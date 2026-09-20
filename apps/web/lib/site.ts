// Identidad de ESTE sitio: nombre, dominio, idiomas y navegación.
//
// Es una COSTURA: los componentes del motor (header, footer, layout, SEO) leen
// de acá en vez de tener las rutas y el nombre escritos adentro. Cambiar de
// proyecto es cambiar este archivo, no buscar literales por todo el árbol.

// Dominio según el estatuto de la asociación (Art. 2°, inciso d del listado de
// medios); se puede pisar por env.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://cogollosdeloeste.com.ar"
).replace(/\/$/, "");
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Cogollos del Oeste";
export const SITE_LOGO = `${SITE_URL}/icon.png`;

/** Descripción corta para el manifest de la PWA. */
export const SITE_DESCRIPTION =
  "Portal de Cogollos del Oeste: información de cultivo, REPROCANN y actividades.";

/**
 * Colores del manifest: los de la marca, no los tokens de tema.
 * "Dos Tintas": papel de fondo, tinta azul-negra de acento.
 */
export const MANIFEST_COLORS = { background: "#F6E6CC", theme: "#00001C" };

/**
 * Paleta e inscripciones de la tarjeta que se ve al compartir el sitio.
 *
 * Va acá y no en los tokens de tema porque satori no lee CSS: la imagen se
 * arma con colores literales, y estos son los de la marca —tinta, sol y papel
 * del logo—, que además no se invierten con el tema.
 */
export const OG_CARD = {
  ink: "#00001C",
  sun: "#E4B569",
  paper: "#F6E6CC",
  eyebrow: "Asociación civil · Oeste de CABA",
  tagline: "Etnobotánica, derechos humanos, reducción de daños y ambiente.",
};

/**
 * Idiomas del sitio.
 *
 * ES-only por ahora: la audiencia de la asociación es local. Sumar un idioma
 * es extender esta lista y agregar su bundle en messages/.
 */
export const LOCALES = ["es"] as const;
export const DEFAULT_LOCALE = "es";

export type NavItem = {
  /** Ruta sin el prefijo de idioma. */
  href: string;
  /** Clave dentro del namespace `nav` de los mensajes. */
  key: string;
};

/**
 * Navegación principal, en orden.
 *
 * ⚠️ El header la muestra entera en escritorio y la colapsa en mobile: con más
 * de siete ítems no entra a 768 px. Si se agrega uno, revisar ahí.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", key: "home" },
  { href: "/quienes-somos", key: "about" },
  { href: "/reprocann", key: "reprocann" },
  { href: "/normativa", key: "normativa" },
  { href: "/semillas", key: "seeds" },
  { href: "/clima", key: "weather" },
  { href: "/actividades", key: "events" },
  { href: "/blog", key: "blog" },
  { href: "/contacto", key: "contact" },
];

/** Columnas del pie. `labelKey` es una clave del namespace `footer`. */
export const FOOTER_SECTIONS: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: "sectionSite",
    items: [
      { href: "/", key: "home" },
      { href: "/quienes-somos", key: "about" },
      { href: "/contacto", key: "contact" },
    ],
  },
  {
    labelKey: "sectionInfo",
    items: [
      { href: "/reprocann", key: "reprocann" },
      { href: "/normativa", key: "normativa" },
      { href: "/semillas", key: "seeds" },
      { href: "/clima", key: "weather" },
      { href: "/actividades", key: "events" },
    ],
  },
  {
    labelKey: "sectionEditorial",
    items: [{ href: "/blog", key: "blog" }],
  },
];

/**
 * ¿Esta ruta está anunciada en la navegación del sitio?
 *
 * La usa la página genérica por slug para decidir entre mostrar el placeholder
 * de "sin contenido" y devolver un 404: un enlace del menú que da 404 parece el
 * sitio roto, pero una URL inventada sí tiene que dar 404.
 */
export function isDeclaredPath(path: string): boolean {
  if (NAV_ITEMS.some(i => i.href === path)) return true;
  return FOOTER_SECTIONS.some(s => s.items.some(i => i.href === path));
}
