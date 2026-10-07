import { hasLocale } from "next-intl";
import { permanentRedirect } from "next/navigation";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { NOTAS, destinoUrlVieja } from "@/lib/vertical/archivo";

/**
 * Las direcciones del sitio anterior de la asociación (2014–2021), que publicaba
 * los artículos en /cws/codeloweb/article/<id> y sigue enlazado desde afuera.
 *
 * Un artículo que está en el archivo (o que quedó fusionado en otra nota) va a
 * su nota en /blog/<slug>; cualquier otra dirección del sitio viejo, a
 * /archivo. Siempre con 308: el destino es la casa nueva de esa URL.
 *
 * El middleware de idioma (proxy.ts, del motor) atiende primero: una URL vieja
 * llega sin idioma y la manda a /es/cws/… con un 307, y recién ahí entra esta
 * ruta. Son dos saltos y el primero es temporal; para que fuera uno solo y
 * permanente haría falta una redirección en next.config.ts, que corre antes del
 * middleware y es del motor.
 */
export async function GET(
  _pedido: Request,
  { params }: { params: Promise<{ lang: string; ruta?: string[] }> },
) {
  const { lang, ruta } = await params;
  const locale = hasLocale(routing.locales, lang) ? lang : routing.defaultLocale;
  permanentRedirect(getPathname({ href: destinoUrlVieja(ruta ?? [], NOTAS), locale }));
}
