// Chart primitives for the /semillas panel.
//
// Server-rendered SVG, no client bundle. Interactivity is the native `<title>`
// element (a real tooltip, free) plus a `<details>` table view under each
// figure — so no value is reachable only by hovering.
//
// Mark specs follow the dataviz method: caps ≤24px, 4px rounded data-end square
// at the baseline, 2px surface gap between adjacent bars, hairline solid axes,
// selective direct labels, and text in ink tokens rather than the series colour.
//
// Colour comes from --data-rnc / --data-rnpc (see globals.css). Those two are
// reserved: amber ALWAYS means RNC, ink-blue ALWAYS means RNPC, in every figure
// on the site. Single-series figures use amber as slot 1.

import { Dato as DatoBase, Figure, Leyenda, Tabla } from "@/components/charts/primitivos";
import type { AltasPorAnio, Conteo } from "@/lib/semillas-stats";

// Los envoltorios genericos viven en components/charts: los comparte /clima.
export { Figure, Leyenda, Tabla };

/** `Dato` de semillas: el destacado va SIEMPRE en el ocre del RNC. */
export function Dato(props: Omit<React.ComponentProps<typeof DatoBase>, "colorDestacado">) {
  return <DatoBase {...props} colorDestacado={COLOR_RNC} />;
}

export const COLOR_RNC = "var(--data-rnc)";
export const COLOR_RNPC = "var(--data-rnpc)";

/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */

/**
 * Paired columns: two series, one axis, one unit.
 *
 * Both series count cultivars registered, so they share a scale. A second
 * y-axis here would fabricate a correlation between commercial registration and
 * property titles that the data does not support.
 */
export function ColumnasPareadas({
  datos,
  destacar,
}: {
  datos: AltasPorAnio[];
  /** Year to direct-label. Used sparingly — labelling every column is noise. */
  destacar?: string;
}) {
  const W = 640;
  const H = 260;
  const PAD = { top: 18, right: 12, bottom: 42, left: 34 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const max = Math.max(1, ...datos.flatMap(d => [d.rnc, d.rnpc]));
  // Round the axis top to a clean number so ticks land on readable values.
  const top = Math.ceil(max / 5) * 5;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;

  const bandW = plotW / Math.max(1, datos.length);
  const GAP = 2; // surface gap between the touching pair
  const barW = Math.min(24, (bandW - 28 - GAP) / 2);

  const ticks = [0, top / 2, top];

  return (
    // El texto de un SVG escala con su viewBox: a 390 px de ancho las etiquetas
    // de eje caían a ~5 px, ilegibles. En vez de agrandar la tipografía —que
    // desbalancea el gráfico en desktop— el gráfico conserva su ancho mínimo y
    // es el contenedor el que scrollea. La página nunca scrollea en horizontal.
    <div className="-mx-1 overflow-x-auto px-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 460 }}
        role="img"
        aria-label="Altas por año en el RNC y en el RNPC"
      >
        {ticks.map(t => (
          <g key={t}>
            {/* Hairline, solid, one step off surface — recessive. */}
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--rule)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={y(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
            >
              {t}
            </text>
          </g>
        ))}

        {datos.map((d, i) => {
          const cx = PAD.left + i * bandW + bandW / 2;
          const xRnc = cx - barW - GAP / 2;
          const xRnpc = cx + GAP / 2;
          const esDestacado = d.anio === destacar;
          return (
            <g key={d.anio}>
              <Columna x={xRnc} w={barW} v={d.rnc} y={y} base={PAD.top + plotH} color={COLOR_RNC}>
                {`${d.anio} · RNC: ${d.rnc}`}
              </Columna>
              <Columna
                x={xRnpc}
                w={barW}
                v={d.rnpc}
                y={y}
                base={PAD.top + plotH}
                color={COLOR_RNPC}
              >
                {`${d.anio} · RNPC: ${d.rnpc}`}
              </Columna>

              <text
                x={cx}
                y={H - PAD.bottom + 16}
                textAnchor="middle"
                className={
                  esDestacado ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"
                }
                style={{ fontSize: 11, fontWeight: esDestacado ? 600 : 400 }}
              >
                {d.anio}
              </text>

              {/* Direct-label only the year the story is about. */}
              {esDestacado ? (
                <>
                  <text
                    x={xRnc + barW / 2}
                    y={y(d.rnc) - 7}
                    textAnchor="middle"
                    className="fill-foreground font-mono"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {d.rnc}
                  </text>
                  <text
                    x={xRnpc + barW / 2}
                    y={y(d.rnpc) - 7}
                    textAnchor="middle"
                    className="fill-foreground font-mono"
                    style={{ fontSize: 11, fontWeight: 600 }}
                  >
                    {d.rnpc}
                  </text>
                </>
              ) : null}
            </g>
          );
        })}

        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="var(--rule)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/** One column: rounded at the data end, square at the baseline. */
function Columna({
  x,
  w,
  v,
  y,
  base,
  color,
  children,
}: {
  x: number;
  w: number;
  v: number;
  y: (n: number) => number;
  base: number;
  color: string;
  children: string;
}) {
  const h = base - y(v);
  const r = Math.min(4, w / 2, h);
  return (
    <g>
      <title>{children}</title>
      {h <= 0 ? (
        // A zero still gets a hit target and a hairline, so "no registrations"
        // reads as a measured value rather than a rendering gap.
        <line x1={x} x2={x + w} y1={base} y2={base} stroke={color} strokeWidth="2" />
      ) : (
        <path
          d={`M${x},${base} L${x},${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} L${x + w - r},${y(v)} Q${x + w},${y(v)} ${x + w},${y(v) + r} L${x + w},${base} Z`}
          fill={color}
        />
      )}
      {/* Invisible, generous hit area for the tooltip. */}
      <rect x={x - 4} y={y(v) - 8} width={w + 8} height={Math.max(24, h + 8)} fill="transparent" />
    </g>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Horizontal bars, single series.
 *
 * Nominal categories (breeder names) have no order, so every bar wears slot 1.
 * Colouring them by value would re-encode what bar length already says.
 */
export function BarrasHorizontales({
  datos,
  color = COLOR_RNC,
  unidad,
}: {
  datos: Conteo[];
  color?: string;
  unidad: string;
}) {
  const max = Math.max(1, ...datos.map(d => d.valor));
  return (
    <ul className="space-y-2.5">
      {datos.map(d => (
        <li key={d.etiqueta} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3">
          <div className="min-w-0">
            <p className="truncate font-serif text-sm leading-tight" title={d.etiqueta}>
              {d.etiqueta}
            </p>
            <div className="mt-1 h-2.5 w-full">
              <div
                className="h-full"
                style={{
                  width: `${(d.valor / max) * 100}%`,
                  backgroundColor: color,
                  borderRadius: "0 2px 2px 0",
                }}
                title={`${d.etiqueta}: ${d.valor} ${unidad}`}
              />
            </div>
          </div>
          <span
            className="label text-right text-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {d.valor}
          </span>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Two overlapping totals sharing a whole — how many cultivars hold each
 * registry, and how many hold both.
 *
 * Deliberately NOT a stacked bar: RNC and RNPC overlap (42 cultivars are in
 * both), so stacking them would sum to more than the catalogue and read as a
 * part-to-whole that does not exist.
 */
export function BarrasSuperpuestas({
  total,
  series,
}: {
  total: number;
  series: Array<{ nombre: string; valor: number; color: string; nota?: string }>;
}) {
  return (
    <ul className="space-y-4">
      {series.map(s => (
        <li key={s.nombre}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="label text-muted-foreground">{s.nombre}</span>
            <span className="font-display text-lg leading-none font-semibold">{s.valor}</span>
          </div>
          <div className="mt-1.5 h-3 w-full bg-muted" title={`${s.nombre}: ${s.valor} de ${total}`}>
            <div
              className="h-full"
              style={{
                width: `${(s.valor / Math.max(1, total)) * 100}%`,
                backgroundColor: s.color,
                borderRadius: "0 2px 2px 0",
              }}
            />
          </div>
          {s.nota ? (
            <p className="mt-1 font-serif text-xs text-muted-foreground">{s.nota}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Stat tile. Proportional figures, not tabular: `121` reads loose at display
 * sizes when every digit is forced to the width of a zero.
 */
