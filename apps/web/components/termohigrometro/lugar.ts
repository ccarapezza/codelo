import { cookies } from "next/headers";
import { COOKIE_UBICACION, LUGAR_DEFAULT, type Lugar, parseLugarCookie } from "@/lib/weather";

/**
 * Ubicación elegida por el visitante, o el default del sitio.
 *
 * Vive acá y no en `lib/weather.ts` a propósito: meter `cookies()` ahí le
 * arrastraría una dependencia de servidor de Next al módulo que hoy se testea
 * puro, sin mocks.
 *
 * Son tres líneas, pero es el único punto donde una divergencia haría que la
 * home y /clima muestren ubicaciones distintas sin que nadie se entere.
 *
 * Se lee en el server para que el fetch quede cacheado por `revalidate` y
 * compartido entre todos los visitantes de la misma coordenada redondeada
 * (N visitas = 1 llamada externa). Resolviéndolo en el cliente serían N.
 */
export async function resolverLugar(): Promise<Lugar> {
  const jar = await cookies();
  return parseLugarCookie(jar.get(COOKIE_UBICACION)?.value) ?? LUGAR_DEFAULT;
}
