/**
 * Instrumentos del tablero de /clima.
 *
 * Heredan el material del termohigrómetro de la home —bisel moldeado, cristal
 * hundido, cifras de siete segmentos— en formato chico y repetido. El aparato
 * grande ya definió cómo se ve un instrumento en este sitio; una tarjeta plana
 * al lado leería como otro producto.
 *
 * Lo único que agregan es el TINTE del cristal: doce aparatos ámbar idénticos
 * son indistinguibles de un vistazo, así que cada magnitud tiñe su vidrio con
 * su familia de color (ver los tokens --data-* en globals.css).
 */

import { SegLectura } from "@/components/termohigrometro/SieteSegmentos";
import { dseg } from "@/components/termohigrometro/dseg";

export const TINTE = {
  calor: "var(--data-calor)",
  agua: "var(--data-agua)",
  vegetal: "var(--data-vegetal)",
  viento: "var(--data-viento)",
  uv: "var(--data-uv)",
  sol: "var(--brand-sun)",
} as const;

export type Familia = keyof typeof TINTE;

/**
 * Instrumento con lectura de siete segmentos.
 *
 * `ancho` es la cantidad de posiciones del display: se fija por instrumento y
 * no se calcula del valor, porque un display real no cambia de tamaño cuando
 * la cifra pasa de 9 a 10.
 */
export function Instrumento({
  rotulo,
  valor,
  sr,
  ancho,
  unidad,
  legenda,
  familia = "sol",
  pie,
  tamano = "chico",
}: {
  rotulo: string;
  valor: string;
  sr: string;
  ancho: number;
  unidad?: string;
  legenda?: string;
  familia?: Familia;
  pie?: string;
  tamano?: "grande" | "chico" | "micro";
}) {
  return (
    <div className={`instr ${dseg.variable}`}>
      <div className="instr-vidrio" style={{ ["--tinte" as string]: TINTE[familia] }}>
        <p className="instr-rotulo">{rotulo}</p>
        <div className="mt-1.5">
          <SegLectura
            value={valor}
            ancho={ancho}
            sr={sr}
            tamano={tamano}
            unidad={unidad}
            legenda={legenda}
          />
        </div>
      </div>
      {pie ? (
        <div className="instr-pie">
          <span className="truncate">{pie}</span>
        </div>
      ) : null}
    </div>
  );
}

/** Panel de papel para los gráficos: los tokens de dato necesitan el fondo del
 *  tema para conservar el contraste con el que fueron validados. */
export function Panel({
  titulo,
  bajada,
  children,
  ayuda,
  className,
}: {
  titulo: string;
  bajada?: string;
  children: React.ReactNode;
  ayuda?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`instr-panel min-w-0 ${className ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight font-semibold">{titulo}</h3>
          {bajada ? (
            <p className="mt-1 font-serif text-sm leading-snug text-muted-foreground">{bajada}</p>
          ) : null}
        </div>
        {ayuda}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Arco solar: el recorrido del día con el sol en su posición actual.
 *
 * Es la infografía que mejor explica el fotoperiodo, porque muestra a la vez
 * las tres cosas que importan —cuándo amanece, cuándo atardece y en qué parte
 * del recorrido estamos— sin pedirle al lector que reste horarios.
 *
 * El arco es media circunferencia y no una curva solar real: la elevación
 * verdadera depende de la declinación y la latitud, y dibujarla con precisión
 * falsa sería peor que dibujar el esquema honesto que todo el mundo entiende.
 */
export function ArcoSolar({
  amanece,
  atardece,
  ahora,
  etiquetaAmanece,
  etiquetaAtardece,
}: {
  /** ISO local ("2026-07-22T07:54"). */
  amanece: string;
  atardece: string;
  /** ISO local del momento actual, para ubicar el sol. */
  ahora: string | null;
  etiquetaAmanece: string;
  etiquetaAtardece: string;
}) {
  const min = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const a = min(amanece);
  const b = min(atardece);
  const t = ahora ? min(ahora) : null;

  // 0 = amanecer, 1 = atardecer. Fuera del día queda acotado a los extremos.
  const frac = t === null || b <= a ? null : Math.max(0, Math.min(1, (t - a) / (b - a)));
  const esDeDia = frac !== null && t !== null && t >= a && t <= b;

  // El viewBox lleva margen lateral y al pie para los horarios: con el arco
  // ocupando todo el ancho, "07:54" y "18:05" se cortaban contra el borde.
  const W = 240;
  const H = 112;
  const R = 84;
  const cx = W / 2;
  const cy = H - 22;
  const punto = (f: number) => {
    const ang = Math.PI * (1 - f); // izquierda (π) → derecha (0)
    return { x: cx + R * Math.cos(ang), y: cy - R * Math.sin(ang) };
  };
  const sol = frac === null ? null : punto(frac);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${etiquetaAmanece} ${amanece.slice(11, 16)}, ${etiquetaAtardece} ${atardece.slice(11, 16)}`}
      style={{ width: "100%", height: "auto", maxWidth: 320 }}
    >
      {/* Horizonte */}
      <line x1={cx - R - 8} y1={cy} x2={cx + R + 8} y2={cy} stroke="var(--rule)" strokeWidth={1} />
      {/* Recorrido completo, tenue */}
      <path
        d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
        fill="none"
        stroke="var(--rule)"
        strokeWidth={2}
        strokeDasharray="3 3"
      />
      {/* Tramo ya recorrido, en el ámbar del sol */}
      {frac !== null && frac > 0 ? (
        <path
          d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${punto(frac).x} ${punto(frac).y}`}
          fill="none"
          stroke="var(--brand-sun)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ) : null}
      {sol ? (
        <circle
          cx={sol.x}
          cy={sol.y}
          r={esDeDia ? 7 : 5}
          fill={esDeDia ? "var(--brand-sun)" : "var(--muted)"}
          stroke="var(--brand-ink)"
          strokeWidth={1}
        />
      ) : null}
      <text
        x={cx - R}
        y={cy + 14}
        textAnchor="middle"
        className="fill-muted-foreground font-mono"
        style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
      >
        {amanece.slice(11, 16)}
      </text>
      <text
        x={cx + R}
        y={cy + 14}
        textAnchor="middle"
        className="fill-muted-foreground font-mono"
        style={{ fontSize: 9, fontVariantNumeric: "tabular-nums" }}
      >
        {atardece.slice(11, 16)}
      </text>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Rosa de vientos: de dónde sopla y con qué fuerza.
 *
 * La aguja apunta HACIA DONDE VA el viento, y el rótulo nombra de dónde viene,
 * que es la convención meteorológica ("viento del norte" sopla desde el norte).
 * Confundir las dos es el error clásico de estos gráficos.
 */
export function RosaViento({
  grados,
  velocidad,
  rafaga,
  etiquetaRafaga,
}: {
  /** Dirección DESDE la que sopla, en grados meteorológicos (0 = norte). */
  grados: number;
  velocidad: number;
  rafaga: number | null;
  etiquetaRafaga: string;
}) {
  const R = 34;
  const c = 40;
  // La aguja apunta a donde VA: dirección de origen + 180°.
  const rad = ((grados + 180) * Math.PI) / 180;
  const x = c + R * 0.82 * Math.sin(rad);
  const y = c - R * 0.82 * Math.cos(rad);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" role="img" aria-label={`Viento ${velocidad} km/h`} className="size-20">
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--rule)" strokeWidth={1} />
        {[0, 90, 180, 270].map(g => {
          const r = (g * Math.PI) / 180;
          return (
            <line
              key={g}
              x1={c + (R - 5) * Math.sin(r)}
              y1={c - (R - 5) * Math.cos(r)}
              x2={c + R * Math.sin(r)}
              y2={c - R * Math.cos(r)}
              stroke="var(--rule)"
              strokeWidth={1}
            />
          );
        })}
        <text
          x={c}
          y={12}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 8 }}
        >
          N
        </text>
        <line
          x1={c}
          y1={c}
          x2={x}
          y2={y}
          stroke="var(--data-viento)"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={c} cy={c} r={3} fill="var(--data-viento)" />
      </svg>
      <div>
        <p className="font-display text-2xl leading-none font-semibold tabular-nums">
          {Math.round(velocidad)}
          <span className="ml-1 font-mono text-xs tracking-widest uppercase">km/h</span>
        </p>
        {rafaga !== null ? (
          <p className="label mt-1.5 text-muted-foreground">
            {etiquetaRafaga} {Math.round(rafaga)} km/h
          </p>
        ) : null}
      </div>
    </div>
  );
}
