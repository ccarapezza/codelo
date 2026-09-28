// Los textos del panel, en los dos idiomas.
//
// El panel estaba escrito en castellano DENTRO del JSX, y como Strapi ofrecía
// sólo inglés el resultado era una mezcla sin salida: el chrome en inglés y
// nuestras pantallas en español, con un selector de un solo idioma.
//
// ⚠️ El castellano es la FUENTE, no una traducción. Las pantallas se pensaron y
// se escribieron en castellano —el tono, las advertencias, el voseo— y el
// inglés se redactó contra él. Si hay que cambiar un texto, se cambia el
// castellano primero y después se ajusta el inglés; al revés se pierde la voz.
//
// `es.json` es además el respaldo: si una clave falta en el catálogo activo, se
// muestra el castellano, que es lo que el panel decía antes de todo esto. El
// modo de fallar es "quedó en español", no "quedó en blanco".

import { useIntl } from "react-intl";
import es from "./translations/es.json";

const PREFIJO = "nib.";

/**
 * Traduce una clave del panel.
 *
 * Si lo que recibe NO es una clave conocida lo devuelve tal cual. Eso es lo que
 * permite que las tarjetas que agrega un proyecto (`admin/verticals.ts`) sigan
 * escribiendo sus etiquetas como texto literal sin tener que armar catálogos:
 * el motor usa claves, el proyecto usa texto, y el mismo renderer sirve a los
 * dos.
 */
export function useT() {
  const { formatMessage } = useIntl();
  return (clave: string, valores?: Record<string, string | number>): string => {
    const catalogo = es as Record<string, string>;
    if (!(clave in catalogo)) return clave;
    return formatMessage({ id: PREFIJO + clave, defaultMessage: catalogo[clave] }, valores);
  };
}

/**
 * El locale para fechas y números, según el idioma del panel.
 *
 * Las fechas estaban clavadas en "es-AR": con el panel en inglés, la tabla de
 * auditoría decía "28 sept". El castellano sigue saliendo como en Argentina,
 * que es como se escribió el panel.
 */
export function useLocaleFechas(): string {
  const { locale } = useIntl();
  return locale.startsWith("es") ? "es-AR" : locale;
}

/** Los mensajes listos para `config.translations`, con el prefijo puesto. */
export function catalogoConPrefijo(mensajes: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(mensajes).map(([k, v]) => [PREFIJO + k, v]));
}
