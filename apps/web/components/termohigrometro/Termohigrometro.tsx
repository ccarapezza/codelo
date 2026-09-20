import type { Locale } from "@/i18n/routing";
import { localeTimeZone } from "@/lib/intl";
import { getWeather } from "@/lib/weather";
import { resolverLugar } from "./lugar";
import { Panel } from "./Panel";
import type { PanelProps } from "./tipos";

const relojes = new Map<string, Intl.DateTimeFormat>();

/** Hora actual en la zona de la estación, para que SSR e hidratación coincidan. */
function horaEn(zona: string): string {
  let f = relojes.get(zona);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: zona,
      });
    } catch {
      f = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    relojes.set(zona, f);
  }
  return f.format(new Date());
}

/**
 * Resuelve todo lo que el instrumento necesita: la ubicación (cookie del
 * visitante o el default del sitio) y la lectura de Open-Meteo.
 *
 * ⚠️ Esto tiene que llamarse DENTRO de un límite de <Suspense>, nunca desde el
 * `Promise.all` de la home. Si el await sube ahí, Suspense deja de servir para
 * nada y una caída de Open-Meteo le suma hasta 2 s al TTFB de la página entera.
 *
 * La cookie se lee en el server a propósito: así el fetch queda cacheado por
 * `revalidate` y compartido entre todos los visitantes de la misma coordenada
 * (N visitas = 1 llamada externa). Resolviéndolo en el cliente serían N.
 */
async function cargarInstrumento(locale: Locale): Promise<PanelProps> {
  const lugar = await resolverLugar();

  const zonaLocal = localeTimeZone(locale);
  const lectura = await getWeather(lugar, zonaLocal);

  return {
    lectura,
    lugar,
    horaServidor: horaEn(lectura?.zona ?? zonaLocal),
    locale,
  };
}

export async function Termohigrometro({ locale }: { locale: Locale }) {
  return <Panel {...(await cargarInstrumento(locale))} />;
}
