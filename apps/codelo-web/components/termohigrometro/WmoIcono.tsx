import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import type { WmoGrupo } from "@/lib/weather";

// Los estados que dependen del sol tienen variante nocturna; los demás se ven
// igual de día que de noche. (El design system prohíbe emojis como iconos.)
const ICONO: Record<WmoGrupo, { dia: LucideIcon; noche: LucideIcon }> = {
  despejado: { dia: Sun, noche: Moon },
  parcial: { dia: CloudSun, noche: CloudMoon },
  nublado: { dia: Cloud, noche: Cloud },
  niebla: { dia: CloudFog, noche: CloudFog },
  llovizna: { dia: CloudDrizzle, noche: CloudDrizzle },
  lluvia: { dia: CloudRain, noche: CloudRain },
  nieve: { dia: CloudSnow, noche: CloudSnow },
  tormenta: { dia: CloudLightning, noche: CloudLightning },
};

/**
 * Icono del estado del tiempo. Siempre `aria-hidden`: el texto del estado va
 * visible al lado, así que anunciarlo también sería duplicar.
 */
export function WmoIcono({
  grupo,
  esDeDia,
  className,
}: {
  grupo: WmoGrupo;
  esDeDia: boolean;
  className?: string;
}) {
  const Icono = esDeDia ? ICONO[grupo].dia : ICONO[grupo].noche;
  return <Icono aria-hidden="true" focusable="false" strokeWidth={1.5} className={className} />;
}
