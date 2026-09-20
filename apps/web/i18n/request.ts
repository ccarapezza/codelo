import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/** Mezcla profunda de dos bundles: el del vertical pisa clave por clave. */
function mergeDeep(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const prev = out[k];
    out[k] =
      prev && typeof prev === "object" && !Array.isArray(prev) &&
      v && typeof v === "object" && !Array.isArray(v)
        ? mergeDeep(prev as Record<string, unknown>, v as Record<string, unknown>)
        : v;
  }
  return out;
}

/**
 * Configuración de i18n por request. Resuelve el idioma desde el segmento
 * `[lang]` y carga los mensajes.
 *
 * Son DOS bundles: `<locale>.json` trae las cadenas del motor (blog, etiquetas,
 * cabecera, pie) y `<locale>.vertical.json` las de este proyecto. Se mezclan en
 * profundidad, así que el vertical puede sumar un namespace entero o sólo
 * algunas claves dentro de uno del motor —por ejemplo `nav`, donde cada
 * proyecto agrega las suyas.
 *
 * El bundle del vertical es OPCIONAL: si no existe, se usa sólo el del motor.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const base = (await import(`../messages/${locale}.json`)).default;
  let vertical: Record<string, unknown> = {};
  try {
    vertical = (await import(`../messages/${locale}.vertical.json`)).default;
  } catch {
    // Proyecto sin cadenas propias: sólo las del motor.
  }

  return { locale, messages: mergeDeep(base, vertical) };
});
