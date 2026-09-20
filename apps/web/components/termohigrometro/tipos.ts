import type { Locale } from "@/i18n/routing";
import type { Lectura, Lugar } from "@/lib/weather";

/** Lo que el cargador le pasa al panel. */
export type PanelProps = {
  /** `null` = no se pudo consultar. El panel se dibuja igual, en muerto. */
  lectura: Lectura | null;
  lugar: Lugar;
  /** Hora en la zona de la estación, ya formateada por el server (ver RelojVivo). */
  horaServidor: string;
  locale: Locale;
};
