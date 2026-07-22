/**
 * Marks de /clima. SVG renderizado en el servidor, cero JS de cliente — mismo
 * criterio que `/semillas`, y acá pesa el doble porque la página es dinámica
 * por cookie y todo lo demás es RSC.
 *
 * Interactividad sin JS: `<title>` dentro de cada marca da tooltip nativo, y la
 * `<Figure>` compartida agrega la tabla en `<details>`. Ningún valor depende
 * del hover.
 *
 * Color: `--data-calor` (lo que la atmósfera pide) contra `--data-agua` (lo que
 * hay). La oposición se sostiene en toda la página y está validada con el
 * script del skill de dataviz — ver globals.css.
 */

import type { Dia, Horario } from "@/lib/weather";

export const COLOR_CALOR = "var(--data-calor)";
export const COLOR_AGUA = "var(--data-agua)";
export const COLOR_VEGETAL = "var(--data-vegetal)";
export const COLOR_VIENTO = "var(--data-viento)";
export const COLOR_UV = "var(--data-uv)";

const W = 720;
const H = 200;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

type Serie = { valores: Array<number | null>; color: string; nombre: string };

function extremos(series: Serie[]): { min: number; max: number } {
  const todos = series.flatMap(s => s.valores).filter((v): v is number => v !== null);
  if (todos.length === 0) return { min: 0, max: 1 };
  const min = Math.min(...todos);
  const max = Math.max(...todos);
  if (min === max) return { min: min - 1, max: max + 1 };
  const margen = (max - min) * 0.12;
  return { min: min - margen, max: max + margen };
}

/**
 * Convierte una serie en tramos continuos.
 *
 * Un null es un HUECO, no un cero: interpolar sobre él inventaría un dato y
 * dibujarlo como cero sería una afirmación física falsa (un DPV de 0 kPa es
 * aire saturado, no "sin medición"). Por eso el trazo se parte.
 */
function tramos(valores: Array<number | null>): Array<Array<{ i: number; v: number }>> {
  const out: Array<Array<{ i: number; v: number }>> = [];
  let actual: Array<{ i: number; v: number }> = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) out.push(actual);
      actual = [];
    } else {
      actual.push({ i, v });
    }
  });
  if (actual.length) out.push(actual);
  return out;
}

/** Franjas de noche detrás de la serie. Es chrome, no dato: sin matiz propio. */
function BandaNoche({ horas, etiqueta }: { horas: Horario[]; etiqueta: string }) {
  const paso = PLOT_W / Math.max(1, horas.length - 1);
  const bloques: Array<{ desde: number; hasta: number }> = [];
  let inicio: number | null = null;
  horas.forEach((h, i) => {
    if (!h.esDeDia && inicio === null) inicio = i;
    if ((h.esDeDia || i === horas.length - 1) && inicio !== null) {
      bloques.push({ desde: inicio, hasta: i });
      inicio = null;
    }
  });
  return (
    <g aria-hidden>
      {bloques.map((b, k) => (
        <rect
          key={k}
          x={PAD.left + b.desde * paso}
          y={PAD.top}
          width={Math.max(0, (b.hasta - b.desde) * paso)}
          height={PLOT_H}
          fill="var(--rule)"
          opacity={0.35}
        >
          <title>{etiqueta}</title>
        </rect>
      ))}
    </g>
  );
}

export function LineaHoraria({
  horas,
  series,
  unidad,
  etiquetaNoche,
  formato = (v: number) => v.toFixed(1),
}: {
  horas: Horario[];
  series: Serie[];
  unidad: string;
  etiquetaNoche: string;
  formato?: (v: number) => string;
}) {
  if (horas.length < 2) return null;
  const { min, max } = extremos(series);
  const paso = PLOT_W / (horas.length - 1);
  const x = (i: number) => PAD.left + i * paso;
  const y = (v: number) => PAD.top + PLOT_H - ((v - min) / (max - min)) * PLOT_H;

  // Una marca de eje cada 6 h, más legible que una por hora.
  const ticks = horas.map((h, i) => ({ h, i })).filter(({ i }) => i % 6 === 0);
  const ejeY = [min, (min + max) / 2, max];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Serie horaria en ${unidad}`}
        style={{ minWidth: 520, width: "100%", height: "auto" }}
      >
        <BandaNoche horas={horas} etiqueta={etiquetaNoche} />

        {ejeY.map((v, k) => (
          <g key={k} aria-hidden>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--rule)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
            >
              {formato(v)}
            </text>
          </g>
        ))}

        {series.map(s =>
          tramos(s.valores).map((tramo, k) => (
            <polyline
              key={`${s.nombre}-${k}`}
              points={tramo.map(p => `${x(p.i)},${y(p.v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )),
        )}

        {/* Zonas de hover invisibles: tooltip nativo por hora, sin JS.

            El contenido del <title> se arma como UN solo string. Con varias
            expresiones adyacentes React emite separadores entre nodos de texto
            en SSR que el parser no reconstruye dentro de un <title> de SVG, y
            la hidratación fallaba con el árbol entero regenerándose. */}
        {horas.map((h, i) => {
          const detalle = series
            .map(s => {
              const v = s.valores[i];
              return `${s.nombre} ${v === null ? "s/d" : `${formato(v)} ${unidad}`}`;
            })
            .join(" · ");
          return (
            <rect
              key={h.hora}
              x={x(i) - paso / 2}
              y={PAD.top}
              width={paso}
              height={PLOT_H}
              fill="transparent"
            >
              <title>{`${h.hora.slice(11, 16)} — ${detalle}`}</title>
            </rect>
          );
        })}

        {ticks.map(({ h, i }) => (
          <text
            key={h.hora}
            x={x(i)}
            y={H - 6}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
          >
            {h.hora.slice(11, 16)}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** Serie única → ámbar, según la regla de la casa. */
export function BarrasHorarias({
  horas,
  valores,
  etiqueta,
}: {
  horas: Horario[];
  valores: Array<number | null>;
  etiqueta: string;
}) {
  if (horas.length === 0) return null;
  const alto = 92;
  const paso = PLOT_W / horas.length;
  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${alto}`}
        role="img"
        aria-label={etiqueta}
        style={{ minWidth: 520, width: "100%", height: "auto" }}
      >
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={alto - 18}
          y2={alto - 18}
          stroke="var(--rule)"
          strokeWidth={1}
          aria-hidden
        />
        {horas.map((h, i) => {
          const v = valores[i];
          const plotH = alto - 30;
          const altura = v === null ? 0 : (v / 100) * plotH;
          return (
            <g key={h.hora}>
              {/* 2px de aire entre barras contiguas: el separador es la superficie. */}
              <rect
                x={PAD.left + i * paso + 1}
                y={alto - 18 - altura}
                width={Math.max(1, paso - 2)}
                height={altura}
                fill={COLOR_CALOR}
                rx={2}
              />
              <rect
                x={PAD.left + i * paso}
                y={0}
                width={paso}
                height={alto - 18}
                fill="transparent"
              >
                {/* Un solo string, por lo mismo que en LineaHoraria. */}
                <title>{`${h.hora.slice(11, 16)} — ${v === null ? "s/d" : `${Math.round(v)} %`}`}</title>
              </rect>
            </g>
          );
        })}
        {horas
          .map((h, i) => ({ h, i }))
          .filter(({ i }) => i % 6 === 0)
          .map(({ h, i }) => (
            <text
              key={h.hora}
              x={PAD.left + i * paso + paso / 2}
              y={alto - 4}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
            >
              {h.hora.slice(11, 16)}
            </text>
          ))}
      </svg>
    </div>
  );
}

/**
 * Barra flotante mín–máx sobre una escala común a los 7 días.
 *
 * Escala compartida y no una por fila: si cada día se normalizara solo, todas
 * las barras medirían lo mismo y la comparación —que es el punto de la figura—
 * desaparecería.
 */
export function BarraMinMax({
  dia,
  min,
  max,
  etiquetaMin,
  etiquetaMax,
}: {
  dia: Dia;
  min: number;
  max: number;
  etiquetaMin: string;
  etiquetaMax: string;
}) {
  const rango = max - min || 1;
  const izq = ((dia.minima - min) / rango) * 100;
  const ancho = ((dia.maxima - dia.minima) / rango) * 100;
  const descripcion = `${etiquetaMin} ${dia.minima} ° · ${etiquetaMax} ${dia.maxima} °`;
  return (
    // Tooltip por ATRIBUTO `title`, no por elemento <title>: ese elemento solo
    // es válido dentro de SVG, y suelto en HTML el parser del navegador lo
    // reubica — el árbol servido y el hidratado dejaban de coincidir.
    <div
      className="relative h-2.5 w-full rounded-full bg-muted"
      role="img"
      aria-label={descripcion}
      title={descripcion}
    >
      <div
        className="absolute inset-y-0 rounded-full"
        style={{
          left: `${izq}%`,
          width: `${Math.max(2, ancho)}%`,
          // El gradiente va de agua a calor: la barra ES el recorrido térmico
          // del día, no dos categorías distintas.
          backgroundImage: `linear-gradient(90deg, ${COLOR_AGUA}, ${COLOR_CALOR})`,
        }}
      />
    </div>
  );
}

/**
 * Medidor lineal acotado con marcas de umbral.
 *
 * Barra + marca, nunca un dial de aguja. Y sin semáforo: el UV NO usa la escala
 * verde-amarillo-naranja-rojo de la OMS, que metería cuatro matices ajenos y
 * rompería el sistema de dos tintas. La intensidad va en ámbar y los umbrales
 * se rotulan en mono.
 */
export function Medidor({
  valor,
  min = 0,
  max,
  umbrales = [],
  unidad,
  etiqueta,
}: {
  valor: number;
  min?: number;
  max: number;
  umbrales?: number[];
  unidad?: string;
  etiqueta: string;
}) {
  const pct = Math.max(0, Math.min(1, (valor - min) / (max - min))) * 100;
  return (
    <div>
      <div
        className="relative h-2.5 w-full rounded-full bg-muted"
        role="img"
        aria-label={`${etiqueta}: ${valor}${unidad ? ` ${unidad}` : ""}`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%`, backgroundColor: COLOR_CALOR }}
        />
        {umbrales.map(u => (
          <span
            key={u}
            aria-hidden
            className="absolute inset-y-0 w-px bg-rule"
            style={{ left: `${((u - min) / (max - min)) * 100}%` }}
          />
        ))}
      </div>
      {umbrales.length > 0 ? (
        <div className="label mt-1 flex justify-between text-muted-foreground">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      ) : null}
    </div>
  );
}
