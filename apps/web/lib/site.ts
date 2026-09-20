// Identidad de ESTE sitio: nombre, dominio, idiomas y navegación.
//
// Es una COSTURA: los componentes del motor (header, footer, layout, SEO) leen
// de acá en vez de tener las rutas y el nombre escritos adentro. Arrancar un
// proyecto nuevo es editar este archivo, no buscar literales por todo el árbol.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3400").replace(
  /\/$/,
  "",
);
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Nib";
export const SITE_LOGO = `${SITE_URL}/icon.png`;

/** Descripción corta para el manifest de la PWA. */
export const SITE_DESCRIPTION = "Portal de noticias.";

/** Colores del manifest: los de la marca, no los tokens de tema. */
export const MANIFEST_COLORS = { background: "#FFFFFF", theme: "#111111" };

/**
 * Paleta e inscripciones de la tarjeta que se ve al compartir el sitio.
 *
 * Va acá y no en los tokens de tema porque satori no lee CSS: la imagen se arma
 * con colores literales.
 */
export const OG_CARD = {
  ink: "#111111",
  sun: "#B8542F",
  paper: "#FFFFFF",
  eyebrow: "",
  tagline: "",
};

/**
 * Idiomas del sitio. Sumar uno es extender esta lista y agregar su bundle en
 * messages/ (el del motor y, si hace falta, el del vertical).
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
  { href: "/blog", key: "blog" },
];

/** Columnas del pie. `labelKey` es una clave del namespace `footer`. */
export const FOOTER_SECTIONS: Array<{ labelKey: string; items: NavItem[] }> = [
  {
    labelKey: "sectionSite",
    items: [
      { href: "/", key: "home" },
      { href: "/blog", key: "blog" },
    ],
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
