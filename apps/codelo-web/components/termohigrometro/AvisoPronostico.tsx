import {
  CalendarCheck,
  CloudRain,
  Droplets,
  Info,
  Lightbulb,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AvisoPronClave, AvisoPronostico as TipoAviso } from "@/lib/weather";

// Calcado de Aviso.tsx: mismos mapas, mismas clases `.termo-aviso-*`, mismo
// criterio de tono POR CAUSA. Lo único distinto es el namespace de copy y que
// acá el aviso mira hacia adelante, así que puede llevar un día asociado.
const ICONO: Record<AvisoPronClave, LucideIcon> = {
  heladaProxima: ThermometerSnowflake,
  olaDeCalor: ThermometerSun,
  mojadoProlongado: Droplets,
  lluviaFuerte: CloudRain,
  rachasFuertes: Wind,
  uvExtremo: Sun,
  ventanaSeca: Sun,
  ventanaSinLluvia: CalendarCheck,
  sinNovedades: Info,
};

type Tono = "frio" | "calor" | "hongo" | "agua" | "ok" | "neutro";

const TONO: Record<AvisoPronClave, Tono> = {
  heladaProxima: "frio",
  olaDeCalor: "calor",
  mojadoProlongado: "hongo",
  lluviaFuerte: "agua",
  rachasFuertes: "agua",
  uvExtremo: "calor",
  ventanaSeca: "calor",
  ventanaSinLluvia: "ok",
  sinNovedades: "neutro",
};

export async function AvisoPronostico({
  aviso,
  cuandoLegible,
}: {
  aviso: TipoAviso;
  /** Día ya formateado por quien llama; el módulo de datos no sabe de locales. */
  cuandoLegible?: string;
}) {
  const t = await getTranslations("clima");
  const Icono = ICONO[aviso.clave];

  return (
    <div
      className={`termo-aviso termo-aviso-${aviso.severidad} termo-tono-${TONO[aviso.clave]}`}
      role={aviso.severidad === "alerta" ? "alert" : "status"}
    >
      <Icono aria-hidden="true" focusable="false" strokeWidth={1.5} className="termo-aviso-icono" />
      <p className="font-serif text-[0.8125rem] leading-snug">
        {t(`avisos.${aviso.clave}.texto`, { cuando: cuandoLegible ?? "" })}
      </p>

      <Lightbulb aria-hidden="true" focusable="false" strokeWidth={1.5} className="termo-aviso-tip" />
      <p className="font-serif text-[0.8125rem] leading-snug text-muted-foreground">
        {t(`avisos.${aviso.clave}.accion`)}
      </p>
    </div>
  );
}
