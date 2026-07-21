/**
 * Lecturas de siete segmentos con DSEG7 Classic (ver dseg.ts).
 *
 * Dos convenciones de la fuente que hacen todo el trabajo:
 *
 *  - `!` está asignado a "todos los segmentos apagados": es un dígito en
 *    blanco con el ancho correcto. Sirve de relleno a la izquierda sin que las
 *    cifras bailen.
 *  - Los fantasmas se hacen a la vieja usanza de los LCD: una capa con `8` en
 *    todas las posiciones, muy tenue, debajo de la lectura real. Sin eso el
 *    número flota en el vacío y deja de parecer un display.
 *
 * La capa fantasma es la que ocupa el flujo y define el ancho; la lectura va
 * encima en absoluto. Como DSEG es monoespaciada y las dos capas usan la misma
 * puntuación, calzan exacto.
 */

const DIGITOS = new Set("0123456789-!");

/** Rellena a la izquierda con dígitos en blanco hasta `ancho` posiciones. */
function rellenar(value: string, ancho: number): string {
  const usadas = [...value].filter(c => DIGITOS.has(c)).length;
  return "!".repeat(Math.max(0, ancho - usadas)) + value;
}

/** La misma cadena con todos los segmentos encendidos. Puntuación intacta. */
function fantasmaDe(padded: string): string {
  return [...padded].map(c => (DIGITOS.has(c) ? "8" : c)).join("");
}

export function SegLectura({
  value,
  ancho,
  sr,
  tamano = "grande",
  unidad,
  legenda,
}: {
  value: string;
  ancho: number;
  sr: string;
  tamano?: "grande" | "chico" | "micro";
  /** Unidad dibujada CON la fuente, en segmentos. Solo `°` y `C`, que son los
   *  únicos glifos de unidad que trae DSEG7. */
  unidad?: string;
  /** Unidad que la fuente no tiene (`%`). Va en mono al lado, como la leyenda
   *  serigrafiada de un aparato real — que tampoco es de segmentos. */
  legenda?: string;
}) {
  const cifras = rellenar(value, ancho);

  // La unidad va en un span aparte y NO concatenada a la cadena, porque en la
  // cadena heredaba el cuerpo de las cifras y un `°C` del tamaño de un dígito
  // se comía la lectura. Tiene que ir idéntica en las dos capas: la del valor
  // está en absoluto sobre la fantasma, así que cualquier diferencia de ancho
  // las desalinea.
  // `legenda` va acá adentro y no como hermano de la caja: afuera era un ítem
  // flex y ninguna alineación lo dejaba a la misma altura que el `°C`, que sí
  // vive en el flujo de texto. Adentro, las dos comparten `vertical-align`.
  const unidades = (
    <>
      {unidad ? <span className="termo-seg-unidad">{unidad}</span> : null}
      {legenda ? <span className="termo-seg-unidad termo-seg-legenda">{legenda}</span> : null}
    </>
  );

  return (
    <div className={`termo-seg${tamano === "grande" ? "" : ` termo-seg-${tamano}`}`}>
      {/* Lo semántico vive acá: un lector de pantalla nunca debería toparse
          con la cadena cruda, que trae los `!` del relleno. */}
      <span className="sr-only">{sr}</span>

      <span aria-hidden="true" className="termo-seg-caja">
        <span className="termo-seg-fantasma">
          {fantasmaDe(cifras)}
          {unidades}
        </span>
        <span className="termo-seg-valor">
          {/* Los dos puntos se separan para que puedan latir por CSS. */}
          {cifras.split(":").flatMap((trozo, i) =>
            i === 0
              ? [trozo]
              : [
                  <span key={i} className="termo-colon">
                    :
                  </span>,
                  trozo,
                ],
          )}
          {unidades}
        </span>
      </span>
    </div>
  );
}
