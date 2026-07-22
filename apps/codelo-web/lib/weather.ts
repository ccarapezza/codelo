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

/**
 * Set ancho, solo para el tablero de /clima.
 *
 * Va aparte y NO se suma a `CAMPOS`: el fetch de la home está en el camino
 * crítico de la portada con 2 s de timeout, y no tiene por qué pagar campos
 * que su instrumento no muestra.
 */
const CAMPOS_EXTENDIDO = [
  CAMPOS,
  "dew_point_2m",
  "uv_index",
  "cloud_cover",
  "pressure_msl",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
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
    // Solo llegan con el set extendido (ver CAMPOS_EXTENDIDO).
    dew_point_2m?: number;
    uv_index?: number;
    cloud_cover?: number;
    pressure_msl?: number;
    wind_gusts_10m?: number;
    wind_direction_10m?: number;
    precipitation?: number;
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
  /* Los que siguen SOLO vienen con el set extendido. Con el set de la home
     quedan en null, y el instrumento de la portada no los lee: por eso
     agregarlos no le cambió nada. */
  rocio: number | null;
  uv: number | null;
  nubosidad: number | null;
  presion: number | null;
  rafaga: number | null;
  vientoDir: number | null;
  precipitacion: number | null;
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
    rocio: esNumero(c.dew_point_2m) ? c.dew_point_2m : null,
    uv: esNumero(c.uv_index) ? c.uv_index : null,
    nubosidad: esNumero(c.cloud_cover) ? c.cloud_cover : null,
    presion: esNumero(c.pressure_msl) ? c.pressure_msl : null,
    rafaga: esNumero(c.wind_gusts_10m) ? c.wind_gusts_10m : null,
    vientoDir: esNumero(c.wind_direction_10m) ? c.wind_direction_10m : null,
    precipitacion: esNumero(c.precipitation) ? c.precipitation : null,
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
export async function getWeather(
  lugar: Lugar,
  fallbackZona: string,
  opciones?: { extendido?: boolean },
): Promise<Lectura | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lugar.latitude));
  url.searchParams.set("longitude", String(lugar.longitude));
  // Sin `opciones` pide exactamente lo mismo que antes: la home no cambia de
  // URL, así que tampoco cambia de entrada en el Data Cache.
  url.searchParams.set("current", opciones?.extendido ? CAMPOS_EXTENDIDO : CAMPOS);
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
/* Pronóstico — 48 h horario + 7 días                                          */
/* -------------------------------------------------------------------------- */

/*
 * Va SEPARADO del bloque `current` a propósito, en su propio fetch y con su
 * propio parser. Dos razones:
 *
 *  1. TTL. El `current` se recalcula cada ~15 min y `getWeather` está afinado a
 *     600 s; el bloque diario no cambia en una hora. Un solo fetch obligaría a
 *     elegir un TTL malo para uno de los dos.
 *  2. Degradación. `mapLectura` tira la respuesta ENTERA si falta un campo —
 *     criterio correcto para un instrumento que muestra tres cifras y no puede
 *     mostrarlas a medias. Acá el criterio es el opuesto: se descartan los
 *     PUNTOS incompletos y se conserva el resto de la serie. Que se caiga el
 *     pronóstico no puede apagar el termohigrómetro de la home, ni al revés.
 */

const CAMPOS_HORARIO = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "vapour_pressure_deficit",
  "precipitation_probability",
  "weather_code",
  "wind_speed_10m",
  "uv_index",
  "soil_temperature_6cm",
  "soil_moisture_3_9cm",
  "is_day",
].join(",");

const CAMPOS_DIARIO = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "sunshine_duration",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_gusts_10m_max",
  "shortwave_radiation_sum",
  "et0_fao_evapotranspiration",
].join(",");

/**
 * Solo `hora` y `temperatura` son obligatorias. El resto es nullable a
 * propósito: si a una hora le falta el DPV, descartar el punto entero cortaría
 * también la serie de temperatura, que sí estaba. Los gráficos tratan el null
 * como HUECO —parten el trazo— y nunca como cero: un cero en una serie de DPV
 * o de humedad de suelo es una afirmación física falsa, no un dato faltante.
 */
export type Horario = {
  /** Hora local ISO tal cual la manda la API ("2026-07-22T15:00"). */
  hora: string;
  temperatura: number;
  humedad: number | null;
  vpd: number | null;
  rocio: number | null;
  probLluvia: number | null;
  viento: number | null;
  uv: number | null;
  /** °C a 6 cm de profundidad. */
  sueloTemp: number | null;
  /** Contenido volumétrico m³/m³ entre 3 y 9 cm. */
  sueloHumedad: number | null;
  grupo: WmoGrupo;
  esDeDia: boolean;
};

export type Dia = {
  /** Fecha local ISO ("2026-07-22"). */
  fecha: string;
  maxima: number;
  minima: number;
  grupo: WmoGrupo;
  amanece: string | null;
  atardece: string | null;
  /** Duración del día en HORAS (la API la manda en segundos). */
  luzHoras: number | null;
  /** Horas de sol efectivas: contra `luzHoras` da cuán cerrado estuvo el día. */
  solHoras: number | null;
  uvMax: number | null;
  lluviaMm: number | null;
  probLluvia: number | null;
  rafagaMax: number | null;
  /** Radiación global acumulada, MJ/m². Crudo: el DLI se deriva aparte. */
  radiacionMJ: number | null;
  /** Evapotranspiración de referencia, mm. */
  et0: number | null;
};

export type Pronostico = { horas: Horario[]; dias: Dia[] };

type OpenMeteoPronostico = {
  hourly?: Record<string, Array<number | string | null> | undefined>;
  daily?: Record<string, Array<number | string | null> | undefined>;
};

/** Lee el índice `i` de una columna y devuelve number o null. */
function num(col: Array<number | string | null> | undefined, i: number): number | null {
  const v = col?.[i];
  return esNumero(v) ? v : null;
}

function txt(col: Array<number | string | null> | undefined, i: number): string | null {
  const v = col?.[i];
  return typeof v === "string" && v ? v : null;
}

/**
 * Largo seguro de un bloque de columnas paralelas.
 *
 * Open-Meteo devuelve arrays paralelos y, ante una respuesta parcial, pueden
 * venir con largos distintos. Recorrer con `time.length` produciría filas
 * leyendo `undefined` de las columnas cortas; se usa el mínimo de las presentes.
 */
function largoSeguro(bloque: Record<string, Array<number | string | null> | undefined> | undefined) {
  if (!bloque) return 0;
  const largos = Object.values(bloque)
    .filter((c): c is Array<number | string | null> => Array.isArray(c))
    .map(c => c.length);
  return largos.length ? Math.min(...largos) : 0;
}

/**
 * Parser tolerante. Un punto se descarta solo si le falta lo que lo identifica
 * (la hora/fecha) o su magnitud principal; lo demás entra como null.
 *
 * Devuelve las dos series por separado y NUNCA propaga el criterio de
 * `mapLectura`: que falte el bloque horario no invalida el diario.
 */
export function mapPronostico(json: OpenMeteoPronostico): Pronostico | null {
  const h = json.hourly;
  const d = json.daily;

  const horas: Horario[] = [];
  for (let i = 0; i < largoSeguro(h); i++) {
    const hora = txt(h?.time, i);
    const temperatura = num(h?.temperature_2m, i);
    if (!hora || temperatura === null) continue;

    horas.push({
      hora,
      temperatura,
      humedad: num(h?.relative_humidity_2m, i),
      vpd: num(h?.vapour_pressure_deficit, i),
      rocio: num(h?.dew_point_2m, i),
      probLluvia: num(h?.precipitation_probability, i),
      viento: num(h?.wind_speed_10m, i),
      uv: num(h?.uv_index, i),
      sueloTemp: num(h?.soil_temperature_6cm, i),
      sueloHumedad: num(h?.soil_moisture_3_9cm, i),
      grupo: wmoGrupo(num(h?.weather_code, i) ?? undefined),
      esDeDia: num(h?.is_day, i) !== 0,
    });
  }

  const dias: Dia[] = [];
  for (let i = 0; i < largoSeguro(d); i++) {
    const fecha = txt(d?.time, i);
    const maxima = num(d?.temperature_2m_max, i);
    const minima = num(d?.temperature_2m_min, i);
    if (!fecha || maxima === null || minima === null) continue;

    const luzSeg = num(d?.daylight_duration, i);
    const solSeg = num(d?.sunshine_duration, i);
    dias.push({
      fecha,
      maxima,
      minima,
      grupo: wmoGrupo(num(d?.weather_code, i) ?? undefined),
      amanece: txt(d?.sunrise, i),
      atardece: txt(d?.sunset, i),
      luzHoras: luzSeg === null ? null : horasDeLuz(luzSeg),
      solHoras: solSeg === null ? null : horasDeLuz(solSeg),
      uvMax: num(d?.uv_index_max, i),
      lluviaMm: num(d?.precipitation_sum, i),
      probLluvia: num(d?.precipitation_probability_max, i),
      rafagaMax: num(d?.wind_gusts_10m_max, i),
      radiacionMJ: num(d?.shortwave_radiation_sum, i),
      et0: num(d?.et0_fao_evapotranspiration, i),
    });
  }

  if (horas.length === 0 && dias.length === 0) return null;
  return { horas, dias };
}

/**
 * El bloque `hourly` arranca a las 00:00 de HOY, no en la hora actual —
 * verificado contra la API: a las 12:45 la serie empieza en 00:00. Sin este
 * recorte, media curva sería pasado y a las 23:00 quedaría casi toda.
 *
 * El cursor es `current.time`, que viene en hora local igual que las claves del
 * bloque horario: comparar strings ISO alcanza y evita aritmética de zonas.
 * Si no hay cursor o no matchea, devuelve las primeras `n` sin tocar — degrada
 * a "muestro algo" en vez de quedarse sin serie.
 */
export function recortarDesdeAhora(horas: Horario[], ahora: string | null, n = 48): Horario[] {
  if (!ahora) return horas.slice(0, n);
  // La hora en curso todavía sirve: se busca el primer punto que no haya
  // terminado, comparando por prefijo de hora ("2026-07-22T12").
  const cursor = ahora.slice(0, 13);
  const desde = horas.findIndex(h => h.hora.slice(0, 13) >= cursor);
  if (desde === -1) return horas.slice(0, n);
  return horas.slice(desde, desde + n);
}

export async function getPronostico(lugar: Lugar): Promise<Pronostico | null> {
  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lugar.latitude));
  url.searchParams.set("longitude", String(lugar.longitude));
  url.searchParams.set("hourly", CAMPOS_HORARIO);
  url.searchParams.set("daily", CAMPOS_DIARIO);
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");

  try {
    const response = await fetch(url.toString(), {
      // Una hora: el modelo diario no se rehace más seguido que eso, y las 48 h
      // horarias se desplazan de a una hora por definición.
      next: { revalidate: 3600 },
      // 5 s, no los 2 s del termohigrómetro. El payload medido tarda ~1,1 s y
      // acá el criterio es otro: en la home el fetch compite con el resto de la
      // portada, pero en /clima el pronóstico ES la página y esperar es lo
      // correcto. Con 2 s, un hop lento la dejaba sin datos.
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return mapPronostico((await response.json()) as OpenMeteoPronostico);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Derivaciones — luz, fotoperiodo, riego                                      */
/* -------------------------------------------------------------------------- */

/** Segundos → horas. La API manda `daylight_duration` en segundos. */
export function horasDeLuz(segundos: number): number {
  return segundos / 3600;
}

/**
 * DLI (Daily Light Integral, mol/m²/día) estimado desde la radiación global.
 *
 * `shortwave_radiation_sum` es radiación de banda ancha (~300–3000 nm) en
 * MJ/m². El DLI son moles de fotones PAR. La conversión encadena dos factores
 * de la literatura:
 *   - PAR ≈ 45 % de la radiación global, en energía (Monteith & Unsworth;
 *     Britton & Dodd 1976).
 *   - 4,57 µmol de fotones por J de PAR en luz diurna (McCree 1972,
 *     Agricultural Meteorology).
 * 10⁶ J/MJ × 0,45 × 4,57 µmol/J ÷ 10⁶ µmol/mol ≈ 2,06.
 *
 * ⚠️ Es ESTIMADO, no medido, con un margen del orden del ±10 %: la fracción PAR
 * se mueve con la nubosidad (el cielo cubierto da difusa proporcionalmente más
 * rica en PAR) y con la altura solar. Sirve para comparar días entre sí, no
 * como valor de sensor — la UI lo dice, no lo deja en una nota al pie.
 *
 * Contraste contra el archivo histórico de Buenos Aires: verano despejado
 * 56–64, verano nublado ~21, invierno cerrado ~13 mol/m²/día. Los órdenes de
 * magnitud son los correctos.
 */
export function dliDesdeRadiacion(mj: number): number {
  return mj * 2.06;
}

/**
 * Bandas descriptivas de DLI, para rotular un día sin prescribir nada.
 *
 * Cortes en 10 / 20 / 35 mol·m⁻²·d⁻¹ tomados de la práctica hortícola general
 * (Faust & Logan 2018, HortScience — la referencia de los mapas de DLI).
 *
 * ⚠️ Describen el DÍA ("día de luz alta"), nunca un objetivo de cultivo. No hay
 * tabla de DLI por etapa fenológica acá, por la misma razón por la que no hay
 * tabla de DPV por etapa: ver la nota de `evaluarAviso`.
 */
export type BandaLuz = "baja" | "media" | "alta" | "muyAlta";

export function bandaDli(dli: number): BandaLuz {
  if (dli < 10) return "baja";
  if (dli < 20) return "media";
  if (dli < 35) return "alta";
  return "muyAlta";
}

/**
 * Qué proporción de las horas de luz tuvo sol efectivo (0–1). Contra un día
 * cerrado da bajo aunque el día sea largo.
 *
 * Se acota a 1: `sunshine_duration` puede superar por poco a `daylight_duration`
 * en la salida del modelo.
 */
export function fraccionDeSol(dia: Dia): number | null {
  if (dia.luzHoras === null || dia.solHoras === null || dia.luzHoras <= 0) return null;
  return Math.min(1, dia.solHoras / dia.luzHoras);
}

export type Tendencia = "alarga" | "acorta" | "estable";

/**
 * Hacia dónde va el fotoperiodo, y a qué ritmo en minutos por día.
 *
 * En el hemisferio sur el día se acorta desde el solsticio de diciembre
 * (~14,5 h en CABA) hasta el de junio (~9,8 h), y ese acortamiento es el
 * disparador principal de la floración a campo.
 *
 * ⚠️ El umbral se comunica como MECANISMO y como RANGO, nunca como fecha ni
 * como interruptor: depende del cultivar, las autoflorecientes no responden al
 * fotoperiodo, y aun con días largos la planta termina floreciendo por edad
 * (Spitzer-Rimon et al. 2019). Las cifras de 12–14 h que circulan son un rango
 * reportado (Moher et al. 2021, Front Plant Sci), no un número único.
 *
 * Se promedia por día en vez de ajustar una recta: sobre 7 puntos casi
 * colineales un ajuste no compra nada. El piso de 0,5 min/día evita llamar
 * "tendencia" al ruido cerca de los solsticios, donde el día casi no se mueve.
 */
export function tendenciaFotoperiodo(
  dias: Dia[],
): { sentido: Tendencia; minutosPorDia: number } | null {
  const conLuz = dias.filter(d => d.luzHoras !== null);
  if (conLuz.length < 2) return null;

  const delta = conLuz[conLuz.length - 1].luzHoras! - conLuz[0].luzHoras!;
  const minutosPorDia = (delta * 60) / (conLuz.length - 1);
  if (Math.abs(minutosPorDia) < 0.5) return { sentido: "estable", minutosPorDia };
  return { sentido: minutosPorDia > 0 ? "alarga" : "acorta", minutosPorDia };
}

/**
 * Balance hídrico del día: lo que la atmósfera pide (ET₀) menos lo que llueve.
 *
 * Positivo = el suelo pierde agua. Se expone como BALANCE en mm y no como
 * "regá N litros": traducir a litros exige saber área, sustrato, cobertura y
 * etapa, y ninguno de esos datos está acá.
 */
export function balanceHidrico(et0: number | null, lluviaMm: number | null): number | null {
  if (et0 === null) return null;
  return et0 - (lluviaMm ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Avisos prospectivos                                                         */
/* -------------------------------------------------------------------------- */

export type AvisoPronClave =
  | "heladaProxima"
  | "olaDeCalor"
  | "mojadoProlongado"
  | "lluviaFuerte"
  | "rachasFuertes"
  | "uvExtremo"
  | "ventanaSeca"
  | "ventanaSinLluvia"
  | "sinNovedades";

export type AvisoPronostico = {
  clave: AvisoPronClave;
  severidad: Severidad;
  /** Fecha ISO del día al que se refiere, si aplica. La UI la formatea. */
  cuando?: string;
};

/** Corridas de horas consecutivas que cumplen un predicado. */
function rachaMaxima(horas: Horario[], pred: (h: Horario) => boolean): number {
  let max = 0;
  let actual = 0;
  for (const h of horas) {
    actual = pred(h) ? actual + 1 : 0;
    if (actual > max) max = actual;
  }
  return max;
}

/**
 * Avisos mirando hacia adelante. A diferencia de `evaluarAviso`, devuelve
 * VARIOS: el termohigrómetro de la home es un aparato chico y un muro de
 * alertas no se lee, pero una página dedicada sí sostiene una lista corta.
 * Igual se acota a 4 y se ordena por severidad.
 *
 * Umbrales, con las mismas fuentes que la cascada de `evaluarAviso`:
 *  - Helada: mínima ≤3 °C y no ≤0, por el enfriamiento radiativo de superficie
 *    (UVM Extension) que ya explica `avisos.riesgoHelada`.
 *  - Calor: ≥35 °C dos días seguidos. Chandra et al. 2011 mide la caída
 *    fotosintética hacia los 40 °C; el aviso se adelanta al episodio.
 *  - Mojado prolongado: ≥8 h seguidas de HR ≥90 %. Es la ventana de infección
 *    de Botrytis (OSU/PNW), la misma que dispara `botrytisVentana` en el ahora.
 *  - El resto son umbrales operativos de trabajo a campo, no fisiológicos.
 */
export function evaluarAvisosPronostico(p: Pronostico): AvisoPronostico[] {
  const avisos: AvisoPronostico[] = [];
  const { horas, dias } = p;

  const helada = dias.find(d => d.minima <= 3);
  if (helada) {
    avisos.push({
      clave: "heladaProxima",
      severidad: helada.minima <= 0 ? "alerta" : "atencion",
      cuando: helada.fecha,
    });
  }

  const calor = dias.find((d, i) => d.maxima >= 35 && dias[i + 1] && dias[i + 1].maxima >= 35);
  if (calor) avisos.push({ clave: "olaDeCalor", severidad: "alerta", cuando: calor.fecha });

  if (rachaMaxima(horas, h => h.humedad !== null && h.humedad >= 90) >= 8) {
    avisos.push({ clave: "mojadoProlongado", severidad: "alerta" });
  }

  const lluvia = dias.find(d => (d.lluviaMm ?? 0) >= 20);
  if (lluvia) avisos.push({ clave: "lluviaFuerte", severidad: "atencion", cuando: lluvia.fecha });

  const racha = dias.find(d => (d.rafagaMax ?? 0) >= 60);
  if (racha) avisos.push({ clave: "rachasFuertes", severidad: "atencion", cuando: racha.fecha });

  const uv = dias.find(d => (d.uvMax ?? 0) >= 8);
  if (uv) avisos.push({ clave: "uvExtremo", severidad: "atencion", cuando: uv.fecha });

  // Tres días seguidos sin lluvia y con la atmósfera pidiendo agua.
  const seca = dias.some((_, i) =>
    [0, 1, 2].every(k => {
      const d = dias[i + k];
      return d && (d.lluviaMm ?? 0) < 1 && (balanceHidrico(d.et0, d.lluviaMm) ?? 0) > 0;
    }),
  );
  if (seca) avisos.push({ clave: "ventanaSeca", severidad: "atencion" });

  // Solo si no hay nada urgente: es una oportunidad, no un riesgo.
  if (avisos.length === 0) {
    const sinLluvia = horas.length > 0 && horas.every(h => (h.probLluvia ?? 0) <= 60);
    avisos.push(
      sinLluvia
        ? { clave: "ventanaSinLluvia", severidad: "info" }
        : { clave: "sinNovedades", severidad: "info" },
    );
  }

  const orden: Record<Severidad, number> = { alerta: 0, atencion: 1, ok: 2, info: 3 };
  return avisos.sort((a, b) => orden[a.severidad] - orden[b.severidad]).slice(0, 4);
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
