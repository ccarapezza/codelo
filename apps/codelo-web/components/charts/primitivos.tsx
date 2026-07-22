/**
 * Piezas compartidas de las figuras del sitio.
 *
 * Viven acá y no dentro de una carpeta de ruta porque las usan `/semillas` y
 * `/clima`: una ruta importando componentes de OTRA ruta se rompe en cuanto una
 * de las dos se mueve de lugar.
 *
 * El `<details>` con la tabla no es un extra: es el contrato de accesibilidad de
 * todas las figuras —ningún valor alcanzable solo por hover— y por eso vive en
 * el envoltorio compartido, donde no puede divergir entre páginas.
 *
 * Los marks concretos (columnas, barras, líneas) NO se promueven: cada página
 * tipa los suyos contra su propio modelo de datos.
 */

export function Figure({
  titulo,
  bajada,
  children,
  tabla,
  etiquetaTabla = "Ver los datos",
}: {
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
  /** Vista de tabla: todo valor alcanzable sin hover. */
  tabla?: React.ReactNode;
  etiquetaTabla?: string;
}) {
  return (
    // `min-w-0` no es cosmético: un ítem de grid tiene `min-width: auto` por
    // defecto, así que el ancho mínimo del gráfico estiraba la columna y hacía
    // scrollear la PÁGINA entera en horizontal. Con esto el scroll queda donde
    // corresponde, dentro del contenedor del gráfico.
    <figure className="m-0 min-w-0">
      <figcaption>
        {titulo ? (
          <h3 className="font-display text-xl leading-tight font-semibold">{titulo}</h3>
        ) : null}
        {bajada ? (
          <p className="mt-1.5 max-w-prose font-serif text-sm leading-relaxed text-muted-foreground">
            {bajada}
          </p>
        ) : null}
      </figcaption>
      <div className="mt-4">{children}</div>
      {tabla ? (
        <details className="group mt-3">
          <summary className="label cursor-pointer text-muted-foreground hover:text-ember">
            {etiquetaTabla}
          </summary>
          <div className="mt-2 overflow-x-auto">{tabla}</div>
        </details>
      ) : null}
    </figure>
  );
}

export function Leyenda({ series }: { series: Array<{ color: string; nombre: string }> }) {
  return (
    <ul className="label flex flex-wrap gap-x-5 gap-y-1.5">
      {series.map(s => (
        <li key={s.nombre} className="flex items-center gap-2">
          {/* La identidad viaja en una marca de color al lado del texto, nunca
              en el color del texto. */}
          <span
            aria-hidden
            className="inline-block size-2.5 shrink-0"
            style={{ backgroundColor: s.color }}
          />
          <span className="text-muted-foreground">{s.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

export function Tabla({ head, rows }: { head: string[]; rows: Array<Array<string | number>> }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-rule">
          {head.map(h => (
            <th key={h} className="label py-1.5 pr-4 font-medium text-muted-foreground">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-rule/60">
            {r.map((cell, j) => (
              <td
                key={j}
                className={`py-1.5 pr-4 font-serif text-sm ${j === 0 ? "" : "tabular-nums"}`}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Cifra grande con su rótulo. El color de `destacado` lo elige quien la usa. */
export function Dato({
  valor,
  etiqueta,
  nota,
  destacado,
  colorDestacado,
}: {
  valor: string | number;
  etiqueta: string;
  nota?: string;
  destacado?: boolean;
  colorDestacado?: string;
}) {
  return (
    <div
      className="border-t-2 border-rule pt-3"
      style={destacado && colorDestacado ? { borderColor: colorDestacado } : undefined}
    >
      <p
        className={`font-display leading-none font-semibold ${destacado ? "text-[clamp(2.5rem,6vw,3.75rem)]" : "text-[clamp(1.75rem,4vw,2.5rem)]"}`}
      >
        {valor}
      </p>
      <p className="label mt-2 text-foreground">{etiqueta}</p>
      {nota ? (
        <p className="mt-1 font-serif text-sm leading-snug text-muted-foreground">{nota}</p>
      ) : null}
    </div>
  );
}
