// Marcas de la Copa Cata (/copa-cata). Servidor, cero JS de cliente, como
// /semillas y /clima: el tooltip es el <title> nativo de cada marca y cada
// figura trae su tabla en <details> (Figure de primitivos.tsx), así que ningún
// valor depende del hover.
//
// Las marcas son SVG a tamaño real dentro de una grilla HTML, y no un SVG
// entero escalado por su viewBox: con viewBox el texto se achicaba con el
// ancho y a 375 px los rótulos de los años caían a 5 px. Acá los rótulos son
// texto de la página y no cambian de tamaño; solo las marcas se dibujan.
//
// Color: --data-copa-flor / --data-copa-extracto / --data-copa-otro, validados
// con el skill de dataviz sobre la noche de la sección (cifras en vertical.css,
// bloque NOCHE). El color sigue a la familia del premio; una figura de una
// sola serie usa el ocre de flor. El texto nunca lleva el color de la serie.

import { Figure, Leyenda, Tabla } from "@/components/vertical/charts/primitivos";
import { Link } from "@/i18n/navigation";
import type { Familia, MatrizCategorias } from "@/lib/vertical/copa-cata";

export { Figure, Leyenda, Tabla };

export const COLOR_FLOR = "var(--data-copa-flor)";
export const COLOR_EXTRACTO = "var(--data-copa-extracto)";
export const COLOR_OTRO = "var(--data-copa-otro)";

export const COLOR_FAMILIA: Record<Familia, string> = {
  flor: COLOR_FLOR,
  extracto: COLOR_EXTRACTO,
  otro: COLOR_OTRO,
};

const RADIO = 4; // extremo de dato redondeado, base recta

/* -------------------------------------------------------------------------- */

export type Barra = {
  etiqueta: string;
  valor: number;
  /** Una línea chica debajo de la etiqueta ("2015, 2019, 2021"). */
  detalle?: string;
  color?: string;
  /** Si la etiqueta enlaza (al palmarés filtrado, por ejemplo). */
  href?: string;
  /** Las barras con el mismo grupo van juntas, bajo su nombre. */
  grupo?: string;
};

/**
 * Barras horizontales. Categorías nominales: todas las barras de un grupo
 * llevan el mismo color, y el largo dice el valor. El texto va en tinta y la
 * cifra al final de cada barra. Barras HTML, como las de /semillas: el texto
 * se acomoda al ancho y el extremo de dato se redondea sin deformarse.
 */
export function BarrasHorizontales({
  datos,
  unidad,
  color = COLOR_FLOR,
}: {
  datos: Barra[];
  unidad: string;
  color?: string;
}) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  const grupos: Array<{ nombre: string | undefined; filas: Barra[] }> = [];
  for (const d of datos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.nombre === d.grupo) ultimo.filas.push(d);
    else grupos.push({ nombre: d.grupo, filas: [d] });
  }
  return (
    <div className="space-y-5">
      {grupos.map((g) => (
        <div key={g.nombre ?? "todas"}>
          {g.nombre ? <p className="label mb-2 text-muted-foreground">{g.nombre}</p> : null}
          <ul className="space-y-2.5">
            {g.filas.map((d) => (
              <li
                key={`${d.etiqueta}-${d.detalle ?? ""}`}
                className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-end gap-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-sm leading-tight">
                    {d.href ? (
                      <Link href={d.href} className="underline-offset-2 hover:text-(--ember-texto) hover:underline">
                        {d.etiqueta}
                      </Link>
                    ) : (
                      <span>{d.etiqueta}</span>
                    )}
                    {d.detalle ? (
                      <span className="font-mono text-[11px] text-muted-foreground">{d.detalle}</span>
                    ) : null}
                  </p>
                  <div className="mt-1 h-3 w-full">
                    <div
                      className="h-full"
                      style={{
                        width: `${(d.valor / max) * 100}%`,
                        backgroundColor: d.color ?? color,
                        borderRadius: `0 ${RADIO}px ${RADIO}px 0`,
                      }}
                      title={`${d.etiqueta}: ${d.valor} ${unidad}`}
                    />
                  </div>
                </div>
                <span className="label text-right text-foreground tabular-nums">{d.valor}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Matriz de presencia: qué categoría se premió en qué edición. Filas por
 * familia, columnas por año: las ediciones que le pasa la página, que son las
 * que tienen palmarés. Dos estados que no se confunden: punto lleno (hubo
 * premio) y punto chico (esa categoría no estuvo ese año). Una celda `null`
 * queda vacía.
 */
export function MatrizPresencia({
  matriz,
  rotulos,
  familias,
  textos,
  aria,
}: {
  matriz: MatrizCategorias;
  /** Nombre de cada categoría. */
  rotulos: Record<string, string>;
  /** Nombre de cada familia, para los encabezados de grupo. */
  familias: Record<Familia, string>;
  textos: { sinPremio: string };
  aria: string;
}) {
  const columnas = `minmax(6.5rem, 12rem) repeat(${matriz.anios.length}, minmax(0, 1fr))`;
  const filas: Array<{ tipo: "familia"; familia: Familia } | { tipo: "fila"; fila: MatrizCategorias["filas"][number] }> = [];
  for (const fila of matriz.filas) {
    const anterior = filas[filas.length - 1];
    if (!anterior || (anterior.tipo === "fila" && anterior.fila.familia !== fila.familia)) {
      filas.push({ tipo: "familia", familia: fila.familia });
    }
    filas.push({ tipo: "fila", fila });
  }
  return (
    <div role="img" aria-label={aria}>
      <div className="grid items-center gap-y-1.5" style={{ gridTemplateColumns: columnas }}>
        <span aria-hidden />
        {matriz.anios.map((anio) => (
          <span
            key={anio}
            aria-hidden
            className="text-center font-mono text-[11px] tabular-nums text-muted-foreground"
          >
            <span className="sm:hidden">’{String(anio).slice(2)}</span>
            <span className="hidden sm:inline">{anio}</span>
          </span>
        ))}
        {filas.map((f) =>
          f.tipo === "familia" ? (
            <p
              key={`familia-${f.familia}`}
              className="label col-span-full mt-3 flex items-center gap-2 text-muted-foreground"
            >
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0"
                style={{ backgroundColor: COLOR_FAMILIA[f.familia] }}
              />
              {familias[f.familia]}
            </p>
          ) : (
            <Fila
              key={f.fila.categoria}
              rotulo={rotulos[f.fila.categoria] ?? f.fila.categoria}
              color={COLOR_FAMILIA[f.fila.familia]}
              celdas={f.fila.celdas}
              textos={textos}
            />
          ),
        )}
      </div>
    </div>
  );
}

function Fila({
  rotulo,
  color,
  celdas,
  textos,
}: {
  rotulo: string;
  color: string;
  celdas: MatrizCategorias["filas"][number]["celdas"];
  textos: { sinPremio: string };
}) {
  return (
    <>
      <span className="pr-2 font-serif text-sm leading-tight">{rotulo}</span>
      {celdas.map((c) => {
        if (c.premios === null) return <span key={c.anio} aria-hidden />;
        const titulo =
          c.premios === 0
            ? `${c.anio} · ${rotulo}: ${textos.sinPremio.toLowerCase()}`
            : `${c.anio} · ${rotulo}: ${c.premios} ${c.premios === 1 ? "premio" : "premios"}`;
        return (
          <span key={c.anio} className="flex justify-center">
            <svg width={14} height={14} viewBox="0 0 14 14" className="overflow-visible">
              <title>{titulo}</title>
              {c.premios === 0 ? (
                <circle cx={7} cy={7} r={1.5} fill="var(--muted-foreground)" opacity={0.6} />
              ) : (
                // Punto de 10 px. Sin anillo: en la matriz nada se superpone.
                <circle cx={7} cy={7} r={5} fill={color} />
              )}
              {/* Área de toque generosa para el tooltip. */}
              <rect x={-4} y={-4} width={22} height={22} fill="transparent" />
            </svg>
          </span>
        );
      })}
    </>
  );
}

/** La leyenda de la matriz: las tres familias y el punto chico. */
export function LeyendaMatriz({
  familias,
  textos,
}: {
  familias: Record<Familia, string>;
  textos: { sinPremio: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <Leyenda
        series={(Object.keys(familias) as Familia[]).map((f) => ({
          color: COLOR_FAMILIA[f],
          nombre: familias[f],
        }))}
      />
      <ul className="label flex flex-wrap gap-x-5 gap-y-1.5">
        <li className="flex items-center gap-2">
          <svg width={10} height={10} aria-hidden>
            <circle cx={5} cy={5} r={1.5} fill="var(--muted-foreground)" opacity={0.6} />
          </svg>
          <span className="text-muted-foreground">{textos.sinPremio}</span>
        </li>
      </ul>
    </div>
  );
}
