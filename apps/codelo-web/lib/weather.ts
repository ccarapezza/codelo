/**
 * Estado del aire exterior — Open-Meteo.
 *
 * Sin API key ni registro. El bloque `current` se recalcula cada ~15 min del
 * lado de ellos, así que refrescar más seguido que eso no trae dato nuevo.
 *
 * Ojo: el VPD (déficit de presión de vapor) VIENE NATIVO en la respuesta
 * (`vapour_pressure_deficit`, en kPa). No se calcula acá.
 */

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

const CAMPOS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "weather_code",
  "vapour_pressure_deficit",
  "wind_speed_10m",
].join(",");

/** Lugar por el que se consulta. lat/lon YA redondeados a 2 decimales. */
export type Lugar = {
  latitude: number;
  longitude: number;
  /** Etiqueta legible ("Buenos Aires", "Ramos Mejía"). Nunca vacía. */
  label: string;
  /** true si es el default del sitio, false si vino de la cookie del visitante. */
  isDefault: boolean;
};

export const COOKIE_UBICACION = "wx";

export const LUGAR_DEFAULT: Lugar = {
  latitude: -34.61,
  longitude: -58.44,
  label: "Buenos Aires",
  isDefault: true,
};

/**
 * 2 decimales ≈ 1,1 km. Es privacidad y caché a la vez: acota cuánta precisión
 * de la ubicación del visitante sale hacia terceros, y acota la explosión de
 * claves del Data Cache de Next (cada coordenada distinta es una entrada).
 */
export function redondearCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

/* -------------------------------------------------------------------------- */
/* Código WMO                                                                  */
/* -------------------------------------------------------------------------- */

export type WmoGrupo =
  | "despejado"
  | "parcial"
  | "nublado"
  | "niebla"
  | "llovizna"
  | "lluvia"
  | "nieve"
  | "tormenta";

// Los 99 códigos WMO agrupados en los ocho estados que el instrumento sabe
// dibujar. El icono y el texto viven aparte (WmoIcono.tsx y messages/es.json):
// este módulo no importa JSX ni copy.
const WMO: Record<number, WmoGrupo> = {
  0: "despejado",
  1: "parcial",
  2: "parcial",
  3: "nublado",
  45: "niebla",
  48: "niebla",
  51: "llovizna",
  53: "llovizna",
  55: "llovizna",
  56: "llovizna",
  57: "llovizna",
  61: "lluvia",
  63: "lluvia",
  65: "lluvia",
  66: "lluvia",
  67: "lluvia",
  80: "lluvia",
  81: "lluvia",
  82: "lluvia",
  71: "nieve",
  73: "nieve",
  75: "nieve",
  77: "nieve",
  85: "nieve",
  86: "nieve",
  95: "tormenta",
  96: "tormenta",
  99: "tormenta",
};

export function wmoGrupo(code: number | undefined): WmoGrupo {
  if (code === undefined) return "nublado";
  return WMO[code] ?? "nublado";
}

/* -------------------------------------------------------------------------- */
/* Avisos para cultivo a campo                                                 */
/* -------------------------------------------------------------------------- */

export type Severidad = "alerta" | "atencion" | "ok" | "info";

export type AvisoClave =
  | "helada"
  | "riesgoHelada"
  | "calorExtremo"
  | "botrytisVentana"
  | "condensacion"
  | "hongosFavorable"
  | "oidio"
  | "demandaMuyAlta"
  | "demandaAlta"
  | "aireQuieto"
  | "favorable"
  | "neutro";

export type Aviso = { clave: AvisoClave; severidad: Severidad };

/**
 * Punto de rocío por Magnus-Tetens. Sale gratis de T y HR, que ya tenemos.
 *
 * La depresión del punto de rocío (T − Td) predice el mojado foliar bastante
 * mejor que la HR sola: el rocío se forma cuando la hoja se enfría por
 * radiación por debajo del Td del aire, y un sensor en abrigo a 1,5 m no ve
 * eso. Un modelo con Td + viento midió ~40 % menos error que el clásico
 * "HR ≥ 90 %" (Sentelhas et al. 2008, Agric For Meteorol).
 */
export function puntoDeRocio(tempC: number, humedad: number): number {
  const a = 17.62;
  const b = 243.12;
  const hr = Math.min(100, Math.max(1, humedad));
  const gamma = Math.log(hr / 100) + (a * tempC) / (b + tempC);
  return (b * gamma) / (a - gamma);
}

/**
 * Un solo aviso, el primero que matchee en orden de prioridad. Se muestra uno
 * y no todos los que apliquen: un muro de alertas no se lee.
 *
 * ⚠️ Los avisos fúngicos NO se disparan por VPD, a propósito. El umbral
 * biológico es la HUMEDAD, y su equivalente en VPD se corre con la temperatura
 * — HR 90 % son 0,17 kPa a 15 °C pero 0,32 kPa a 25 °C. Un umbral fijo de VPD
 * daría falsos negativos en noches frescas y falsos positivos en tardes
 * cálidas. Cada variable para lo que sirve: HR y punto de rocío para hongos,
 * VPD para demanda evaporativa.
 *
 * ⚠️ Tampoco hay tabla de VPD por etapa. Los rangos que circulan
 * (0,4–0,8 propagación / 0,8–1,2 vegetativo / 1,2–1,6 floración) son setpoints
 * de cultivo en interior controlado, sin respaldo primario ni siquiera ahí, y
 * presuponen dos cosas que a campo no existen: saber en qué etapa está la
 * planta y poder mover el ambiente.
 *
 * Umbrales y sus fuentes:
 *  - Helada: UVM Extension. El aviso preventivo salta a 3 °C y no a 0 porque
 *    con cielo despejado y viento calmo la superficie del cultivo queda 2–4 °C
 *    por debajo de la lectura en abrigo (enfriamiento radiativo).
 *  - Calor: Chandra et al. 2011 (PMC3550580) — a 40 °C la fotosíntesis cae
 *    16–38 % según variedad. Medición directa en Cannabis sativa.
 *  - Botrytis: OSU/PNW Extension + Punja et al. 2023/2025. Necesita agua libre;
 *    ≥8–12 h de mojado foliar entre 10 y 27 °C.
 *  - Oídio: PNW Handbook / UC Davis. Al revés que Botrytis, NO necesita hoja
 *    mojada — el agua libre incluso lo perjudica. Por eso su regla exige que no
 *    esté lloviendo.
 *  - Demanda evaporativa: >2 kPa la transpiración empieza a reducirse en la
 *    mayoría de los cultivos (J Exp Bot 2023). Es fisiología general
 *    extrapolada: en cannabis no hay breakpoint estomático publicado.
 */
export function evaluarAviso(l: Lectura): Aviso {
  const t = l.temperatura;
  const hr = l.humedad;
  const td = puntoDeRocio(t, hr);
  const precipita =
    l.grupo === "lluvia" || l.grupo === "llovizna" || l.grupo === "tormenta" || l.grupo === "nieve";

  if (t <= 0) return { clave: "helada", severidad: "alerta" };
  if (t <= 3) return { clave: "riesgoHelada", severidad: "atencion" };
  if (t >= 38) return { clave: "calorExtremo", severidad: "alerta" };

  if (hr >= 90 && t >= 10 && t <= 27) return { clave: "botrytisVentana", severidad: "alerta" };
  if (!l.esDeDia && t - td <= 2 && t >= 10 && t <= 27)
    return { clave: "condensacion", severidad: "alerta" };
  if (hr >= 75 && t >= 17 && t <= 24) return { clave: "hongosFavorable", severidad: "atencion" };
  if (hr >= 70 && t >= 20 && t <= 28 && !precipita)
    return { clave: "oidio", severidad: "atencion" };

  if (l.vpd >= 3.0) return { clave: "demandaMuyAlta", severidad: "alerta" };
  if (l.vpd >= 2.0) return { clave: "demandaAlta", severidad: "atencion" };
  if (l.vpd <= 0.25) return { clave: "aireQuieto", severidad: "atencion" };

  if (l.vpd >= 0.4 && l.vpd <= 1.6 && t >= 15 && t <= 30 && hr < 70)
    return { clave: "favorable", severidad: "ok" };

  return { clave: "neutro", severidad: "info" };
}

/* -------------------------------------------------------------------------- */
/* Fetch                                                                       */
/* -------------------------------------------------------------------------- */

/** DTO crudo. Todo opcional: no confiamos en el shape ajeno. */
type OpenMeteoForecast = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    is_day?: number;
    weather_code?: number;
    vapour_pressure_deficit?: number;
    wind_speed_10m?: number;
  };
};

export type Lectura = {
  temperatura: number; // °C
  sensacion: number | null; // °C
  humedad: number; // % HR
  vpd: number; // kPa
  viento: number | null; // km/h
  grupo: WmoGrupo;
  esDeDia: boolean;
  /** Hora local de la observación, tal cual la manda la API ("2026-07-20T16:30"). */
  observadoEn: string | null;
  /** IANA de la estación, p.ej. "America/Argentina/Buenos_Aires". */
  zona: string;
};

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function mapLectura(json: OpenMeteoForecast, fallbackZona: string): Lectura | null {
  const c = json.current;
  if (!c) return null;

  // Las tres que el instrumento muestra sí o sí. Si falta alguna, no hay
  // lectura: mejor el estado "sin lectura" que un display a medio llenar.
  if (!esNumero(c.temperature_2m)) return null;
  if (!esNumero(c.relative_humidity_2m)) return null;
  if (!esNumero(c.vapour_pressure_deficit)) return null;

  return {
    temperatura: c.temperature_2m,
    sensacion: esNumero(c.apparent_temperature) ? c.apparent_temperature : null,
    humedad: c.relative_humidity_2m,
    vpd: c.vapour_pressure_deficit,
    viento: esNumero(c.wind_speed_10m) ? c.wind_speed_10m : null,
    grupo: wmoGrupo(c.weather_code),
    esDeDia: c.is_day !== 0,
    observadoEn: typeof c.time === "string" ? c.time : null,
    zona: typeof json.timezone === "string" && json.timezone ? json.timezone : fallbackZona,
  };
}

/**
 * `revalidate: 600` — el bloque `current` de Open-Meteo se recalcula cada
 * ~15 min, así que pedirlo más seguido gasta cuota sin traer dato nuevo. Da
 * 144 llamadas/día por coordenada, muy por debajo del límite gratuito (~10k).
 * No subo a 900 porque el instrumento muestra a qué hora se midió y una
 * lectura de media hora quedaría fea.
 *
 * El timeout replica el único precedente del repo (app/api/health/route.ts).
 * Es lo que evita que una caída de Open-Meteo cuelgue el render.
 */
export async function getWeather(lugar: Lugar, fallbackZona: string): Promise<Lectura | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lugar.latitude));
  url.searchParams.set("longitude", String(lugar.longitude));
  url.searchParams.set("current", CAMPOS);
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url.toString(), {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) return null;
    return mapLectura((await response.json()) as OpenMeteoForecast, fallbackZona);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Cookie de ubicación                                                         */
/* -------------------------------------------------------------------------- */

/** Serializa para la cookie. Formato: `lat|lon|etiqueta`. */
export function serializarLugar(latitude: number, longitude: number, label: string): string {
  return `${redondearCoord(latitude)}|${redondearCoord(longitude)}|${label}`;
}

/**
 * Lee la cookie del visitante. Es input no confiable: se valida todo.
 *
 * El redondeo se reaplica acá aunque el cliente ya lo haya hecho — es lo que
 * garantiza que una cookie editada a mano no pueda meter coordenadas de
 * precisión arbitraria en la clave del Data Cache.
 */
export function parseLugarCookie(raw: string | undefined): Lugar | null {
  if (!raw) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  const parts = decoded.split("|");
  if (parts.length !== 3) return null;

  const latitude = Number(parts[0]);
  const longitude = Number(parts[1]);
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return null;

  // Caracteres de control y `<>` fuera. React ya escapa el texto, así que no
  // es vía de XSS: es para que una cookie manipulada no ensucie el render
  // con basura invisible.
  const label = parts[2].replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 48);
  if (!label) return null;

  return {
    latitude: redondearCoord(latitude),
    longitude: redondearCoord(longitude),
    label,
    isDefault: false,
  };
}
