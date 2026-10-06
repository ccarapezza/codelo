// Formatos de la Copa Cata del Oeste: fechas dd/mm/aaaa y duraciones.
//
// Las fechas son días de calendario (aaaa-mm-dd), no instantes: se calculan
// en UTC para que el día de la semana no dependa de la zona horaria de la
// máquina que renderiza. `new Date("2019-07-14").getDay()` en una máquina al
// oeste de Greenwich da sábado; el domingo 14/07/2019 tiene que seguir siendo
// domingo en el servidor, en el navegador y en el test.

export const DIAS_SEMANA = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

function partes(iso: string): { anio: number; mes: number; dia: number; semana: DiaSemana } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Fecha inválida (se espera aaaa-mm-dd): "${iso}"`);
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  // Date.UTC desborda en silencio (31/02 → 03/03): se rechaza en vez de corregir.
  if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
    throw new RangeError(`Fecha inexistente: "${iso}"`);
  }
  return { anio, mes, dia, semana: DIAS_SEMANA[fecha.getUTCDay()] };
}

const dos = (n: number) => String(n).padStart(2, "0");

/** "2019-07-14" → "14/07/2019". */
export function formatFechaCorta(iso: string): string {
  const { anio, mes, dia } = partes(iso);
  return `${dos(dia)}/${dos(mes)}/${anio}`;
}

/** "2019-07-14" → "domingo 14/07/2019". */
export function formatFecha(iso: string): string {
  const p = partes(iso);
  return `${p.semana} ${formatFechaCorta(iso)}`;
}

/** Día de la semana de una fecha aaaa-mm-dd, sin depender de la zona horaria. */
export function diaDeLaSemana(iso: string): DiaSemana {
  return partes(iso).semana;
}

/** Duración de un video: 45 → "0:45"; 65 → "1:05"; 3725 → "1:02:05". */
export function formatDuracion(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) throw new RangeError(`Duración inválida: ${segundos}`);
  const total = Math.round(segundos);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`;
}
