import {
  CircleCheck,
  CloudFog,
  DropletOff,
  Droplets,
  Eye,
  Info,
  Lightbulb,
  Snowflake,
  Sun,
  ThermometerSnowflake,
  ThermometerSun,
  TriangleAlert,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { AvisoClave, Severidad } from "@/lib/weather";

// Iconos de Lucide, nunca emojis (anti-patrón explícito del design system).
const ICONO: Record<AvisoClave, LucideIcon> = {
  helada: Snowflake,
  riesgoHelada: ThermometerSnowflake,
  calorExtremo: ThermometerSun,
  botrytisVentana: Droplets,
  condensacion: CloudFog,
  hongosFavorable: TriangleAlert,
  oidio: Eye,
  demandaMuyAlta: DropletOff,
  demandaAlta: Sun,
  aireQuieto: Wind,
  favorable: CircleCheck,
  neutro: Info,
};

/**
 * Familia de color del aviso. Es por CAUSA, no por severidad: el lector
 * distingue antes "esto es frío" de "esto es hongos" que "esto es grave". La
 * gravedad ya la comunica el filete de la izquierda.
 */
type Tono = "frio" | "calor" | "hongo" | "agua" | "ok" | "neutro";

const TONO: Record<AvisoClave, Tono> = {
  helada: "frio",
  riesgoHelada: "frio",
  calorExtremo: "calor",
  botrytisVentana: "hongo",
  condensacion: "agua",
  hongosFavorable: "hongo",
  oidio: "hongo",
  demandaMuyAlta: "calor",
  demandaAlta: "calor",
  aireQuieto: "agua",
  favorable: "ok",
  neutro: "neutro",
};

/**
 * El aviso agronómico.
 *
 * El color va en el icono y en el filete, nunca en el texto: el cuerpo se lee
 * en la tinta de siempre, así que el contraste de lectura no depende del tono.
 */
export async function Aviso({ clave, severidad }: { clave: AvisoClave; severidad: Severidad }) {
  const t = await getTranslations("home");
  const Icono = ICONO[clave];

  return (
    <div
      className={`termo-aviso termo-aviso-${severidad} termo-tono-${TONO[clave]}`}
      // Las alertas se anuncian solas; lo informativo no interrumpe al lector.
      role={severidad === "alerta" ? "alert" : "status"}
    >
      {/* Rejilla de dos columnas: los dos iconos comparten la misma canaleta
          izquierda, así los dos párrafos arrancan en la misma vertical. Antes
          la lamparita iba dentro del texto y le metía una sangría a la
          recomendación. */}
      <Icono aria-hidden="true" focusable="false" strokeWidth={1.5} className="termo-aviso-icono" />
      <p className="font-serif text-[0.8125rem] leading-snug">{t(`wx.avisos.${clave}.texto`)}</p>

      {/* La recomendación se separa del diagnóstico con la lamparita: el primer
          párrafo dice qué está pasando, este qué hacer. Va en ámbar —la segunda
          tinta del sitio— y no en el tono del aviso, que ya está gastado en
          señalar la causa. */}
      <Lightbulb aria-hidden="true" focusable="false" strokeWidth={1.5} className="termo-aviso-tip" />
      <p className="font-serif text-[0.8125rem] leading-snug text-muted-foreground">
        {t(`wx.avisos.${clave}.accion`)}
      </p>
    </div>
  );
}
