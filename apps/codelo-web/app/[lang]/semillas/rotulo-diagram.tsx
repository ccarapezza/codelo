// Schematic anatomy of a cannabis seed label.
//
// Drawn, not photographed, on purpose. A real packet carries a brand, and the
// editorial rule (Art. 2-C) keeps brands and commerce out of the imagery — a
// photo would turn a public-interest diagram into a shop window. Vector also
// stays crisp, follows the theme, and can be labelled precisely.
//
// The geometry mirrors what the packets actually look like: yellow label, text
// set sideways, and the INASE security stamp with its DataMatrix in a corner.
// Every callout maps to a field the Res. INASE 260/2022 requires.

export type CampoRotulo = {
  n: number;
  titulo: string;
  detalle: string;
  /** Which of the two lookups can verify this field, if any. */
  verificable?: "operadores" | "cultivares";
};

export const CAMPOS_ROTULO: CampoRotulo[] = [
  {
    n: 1,
    titulo: "N° de inscripción RNCyFS",
    detalle:
      "Quién fracciona y rotula. Número seguido de letras (13481EFK1): el número es la inscripción, las letras las categorías habilitadas.",
    verificable: "operadores",
  },
  {
    n: 2,
    titulo: "Especie",
    detalle: "Nombre común y botánico: cannabis o cáñamo, y Cannabis sativa L.",
  },
  {
    n: 3,
    titulo: "Nombre del cultivar",
    detalle:
      "Obligatorio desde 2022. Es el dato que permite rastrear la variedad hasta su obtentor.",
    verificable: "cultivares",
  },
  {
    n: 4,
    titulo: "Clase",
    detalle:
      "Siempre «IDENTIFICADA NOMINADA»: es la única clase prevista para semilla de cannabis.",
  },
  {
    n: 5,
    titulo: "Contenido neto y año de cosecha",
    detalle: "Cuántas semillas trae el paquete y de qué año es la producción.",
  },
  {
    n: 6,
    titulo: "Germinación y pureza",
    detalle:
      "Porcentajes mínimos. Ojo: la germinación es un piso declarado, no el resultado de un análisis con su fecha.",
  },
  {
    n: 7,
    titulo: "Cláusula de los 45 días",
    detalle:
      "El identificador responde por la germinación durante 45 días desde la entrega. Es el reloj real del rótulo: no hay fecha de vencimiento impresa.",
  },
  {
    n: 8,
    titulo: "Estampilla de seguridad",
    detalle:
      "2×2 cm, se solicita a INASE y es intransferible. Trae un DataMatrix con una serie de 14 caracteres que identifica el paquete — pero no hay consulta pública donde validarla.",
  },
];

/** Callout number badge, reused between the drawing and the list. */
export function Marcador({ n, className = "" }: { n: number; className?: string }) {
  return (
    <span
      className={`label inline-flex size-5 shrink-0 items-center justify-center border border-ink bg-ink text-background ${className}`}
      style={{ fontSize: 10, lineHeight: 1 }}
      aria-hidden
    >
      {n}
    </span>
  );
}

export function RotuloDiagrama() {
  // Fixed brand inks: this is a depiction of a printed object, so it must not
  // invert with the theme — the same reason .duotone pins its own constants.
  const AMARILLO = "#E9C93F";
  const TINTA = "#00001C";
  const PAPEL = "#F6E6CC";
  const VERDE_SELLO = "#0E9070";

  const linea = (x: number, y: number, largo: number, grosor = 3, op = 0.75) => (
    <rect x={x} y={y} width={largo} height={grosor} fill={TINTA} opacity={op} rx={1} />
  );

  return (
    <svg
      viewBox="0 0 420 300"
      className="w-full max-w-md"
      role="img"
      aria-label="Esquema de un rótulo de semillas de cannabis: etiqueta amarilla con los campos obligatorios y la estampilla de seguridad de INASE con su código DataMatrix"
    >
      {/* Sobre */}
      <rect x="10" y="14" width="400" height="272" fill={TINTA} rx="2" />
      <rect x="10" y="14" width="400" height="18" fill={TINTA} opacity="0.55" />

      {/* Rótulo amarillo */}
      <rect x="30" y="44" width="360" height="222" fill={AMARILLO} rx="2" />

      {/* Bloque de texto. En los paquetes reales va impreso de costado; acá se
          endereza para que el esquema se lea, que es lo que tiene que hacer.
          Arranca en x=58 para dejarle la calle a los marcadores. */}
      {linea(58, 64, 150, 5, 0.9)}
      {linea(58, 88, 116)}
      {linea(58, 100, 168)}
      {linea(58, 122, 140, 5, 0.9)}
      {linea(58, 146, 152)}
      {linea(58, 170, 96)}
      {linea(58, 182, 128)}
      {linea(58, 204, 110)}
      {linea(58, 216, 134)}
      {linea(58, 238, 200, 2, 0.45)}
      {linea(58, 246, 188, 2, 0.45)}
      {linea(58, 254, 120, 2, 0.45)}

      {/* Estampilla de seguridad */}
      <g transform="translate(268, 150)">
        <rect x="0" y="0" width="104" height="104" fill={PAPEL} rx="2" />
        {/* Guilloché sugerido con arcos, no dibujado literal */}
        {[0, 1, 2, 3, 4, 5].map(i => (
          <path
            key={i}
            d={`M${64 + i * 2},6 Q${94 - i * 3},52 ${64 + i * 2},98`}
            fill="none"
            stroke={VERDE_SELLO}
            strokeWidth="1.4"
            opacity={0.5}
          />
        ))}
        {/* DataMatrix esquemático: patrón fijo, no un código real —
            no queremos que alguien escanee el dibujo y crea que valida algo. */}
        <g transform="translate(10, 10)">
          <rect x="0" y="0" width="46" height="46" fill={PAPEL} />
          <rect x="0" y="0" width="3" height="46" fill={TINTA} />
          <rect x="0" y="43" width="46" height="3" fill={TINTA} />
          {[...Array(11)].map((_, i) => (
            <rect key={`t${i}`} x={i * 4 + 3} y="0" width="2" height="2" fill={TINTA} />
          ))}
          {[...Array(11)].map((_, i) => (
            <rect key={`r${i}`} x="43" y={i * 4} width="2" height="2" fill={TINTA} />
          ))}
          {[...Array(9)].map((_, r) =>
            [...Array(9)].map((_, c) =>
              // Patrón determinista: se ve como un DataMatrix sin serlo.
              (r * 7 + c * 5 + ((r * c) % 3)) % 3 !== 0 ? (
                <rect
                  key={`${r}-${c}`}
                  x={c * 4 + 5}
                  y={r * 4 + 4}
                  width="3"
                  height="3"
                  fill={TINTA}
                />
              ) : null,
            ),
          )}
        </g>
        <rect x="10" y="62" width="46" height="4" fill={TINTA} opacity="0.7" rx="1" />
        <rect x="10" y="72" width="62" height="9" fill="#E0245E" rx="1" />
        <rect x="10" y="86" width="52" height="3" fill={TINTA} opacity="0.6" rx="1" />
      </g>

      {/* Marcadores. Van en su propia calle (x=42) contra el borde del rótulo,
          y separados ≥22 px: con Ø18 px, menos que eso los hace tocarse —
          el 2 con el 3 y el 5 con el 6 se pisaban. Cada uno se alinea con la
          primera línea del campo que anota. */}
      {(
        [
          [1, 42, 66],
          [2, 42, 94],
          [3, 42, 124],
          [4, 42, 148],
          [5, 42, 176],
          [6, 42, 210],
          [7, 42, 244],
          [8, 262, 144],
        ] as const
      ).map(([n, x, y]) => (
        <g key={n} transform={`translate(${x - 9}, ${y - 9})`}>
          <circle cx="9" cy="9" r="9" fill={TINTA} />
          <text
            x="9"
            y="12.5"
            textAnchor="middle"
            fill={PAPEL}
            style={{ fontSize: 10, fontFamily: "var(--font-mono)", fontWeight: 600 }}
          >
            {n}
          </text>
        </g>
      ))}
    </svg>
  );
}
