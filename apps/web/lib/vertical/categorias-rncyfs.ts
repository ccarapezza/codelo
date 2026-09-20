// Legend for the RNCyFS registration categories.
//
// Two independent sources, both checked on 21/07/2026:
//
//   - INASE's reference sheet, linked from the padrón search page
//     (gestion.inase.gob.ar/empresas/empresas → "Categorías - Referencias"):
//     https://www.argentina.gob.ar/sites/default/files/inase-categorias_rncyfs_v09-24.pdf
//   - The norm behind it: Resolución INASE 474/2024, Anexo I (B.O. 27/09/2024)
//     https://servicios.infoleg.gob.ar/infolegInternet/anexos/400000-404999/404578/norma.htm
//
// ⚠️ The PDF URL carries a version (`v09-24`) and will change when INASE
// reissues it. The resolution is the stable reference; re-read both before
// touching this table.
//
// `descripcion` is INASE's own wording, condensed but not reinterpreted. This
// text tells a reader what a seed seller is authorised to do, so it must stay
// traceable to the source — never paraphrase from memory, and never add a code
// that is not in the sheet.
//
// Verified against all 3.032 rows of the padrón: exactly 16 codes occur, and
// `J`/`K` never appear without their digit. Both exist as parent categories in
// the reference sheet, so both stay defined here.
//
// Two caveats that matter when this is shown to the public:
//
//   - **These describe the activity, not the species.** An operator registered
//     as `F` may expend seed of the species it is registered for, not of every
//     species. The padrón does not publish that scope, so the UI must not imply
//     "authorised for cannabis" from a category alone.
//   - **Res. INASE 653/2023** enabled categories A, B, E, F, H and K for
//     *Cannabis sativa* L. — the categories a cannabis operator can hold.

export type CategoriaInfo = {
  /** Short name for chips and dense lists. */
  nombre: string;
  /** INASE's definition, condensed for reading on screen. */
  descripcion: string;
};

export const CATEGORIAS_RNCYFS: Record<string, CategoriaInfo> = {
  A: {
    nombre: "Criadero",
    descripcion:
      "Investiga y desarrolla nuevas variedades o híbridos comerciales. Habilitado para producir en categoría original y/o híbrida, comercializar su producción e inscribir cultivares en el Registro Nacional de Cultivares.",
  },
  B: {
    nombre: "Introductor",
    descripcion:
      "Realiza ensayos de adaptación agroecológica de materiales de origen extranjero. Puede producir semilla en categoría original o híbrida, comercializar su producción e inscribir cultivares.",
  },
  C: {
    nombre: "Productor de semilla básica o híbrida",
    descripcion:
      "Produce semilla en categoría «Original» o «Híbrida» a partir de material «prebásico» o de «líneas» suministradas por un criadero o introductor. Habilitado para comercializar su producción.",
  },
  D: {
    nombre: "Semillero",
    descripcion:
      "Produce semilla de primera multiplicación u otras multiplicaciones bajo el régimen de fiscalización. Habilitado para comercializar su producción.",
  },
  E: {
    nombre: "Identificador",
    descripcion:
      "Produce y/o rotula semillas en la clase identificada (art. 10° inc. «A» de la Ley 20.247), a partir de material propio o adquirido a terceros. Habilitado para comercializar su producción. Es la categoría de quien se hace responsable por lo que declara el rótulo.",
  },
  F: {
    nombre: "Comerciante expendedor",
    descripcion:
      "Vende o transfiere a cualquier título semilla rotulada por terceros, con destino al mercado interno o al intercambio internacional. Incluye la actividad de vivero expendedor. No habilita por sí sola a multiplicar semilla ni a rotularla.",
  },
  G: {
    nombre: "Procesador",
    descripcion:
      "Limpia, clasifica y/o embolsa semilla identificada por cuenta y orden de terceros. Incluye a los establecimientos que almacenan semillas propias o de terceros a temperatura adecuada para su conservación.",
  },
  H: {
    nombre: "Productor bajo condiciones controladas",
    descripcion:
      "Aplica técnicas de producción bajo condiciones especiales de laboratorio que permiten propagación acelerada, máxima calidad sanitaria y/o incorporación de germoplasma de valor agronómico. Incluye plantineras hortícolas. Habilitado para comercializar su producción.",
  },
  I: {
    nombre: "Laboratorio",
    descripcion:
      "Establecimiento habilitado para realizar análisis de calidad físico botánica, fisiológica, sanitaria y/o de identidad genética de semillas, bajo las normas oficiales.",
  },
  J: {
    nombre: "Vivero certificador",
    descripcion:
      "Produce materiales de propagación (plantas y/o sus partes) dentro del sistema de certificación. Habilitado para comercializar su producción. En el padrón siempre aparece con su subcategoría de tamaño (J1 o J2).",
  },
  J1: {
    nombre: "Vivero certificador de baja producción",
    descripcion:
      "Vivero certificador cuya producción anual no supera las 50.000 unidades del tipo de material que constituye su actividad principal (con topes específicos para materiales secundarios, ajo y forestales).",
  },
  J2: {
    nombre: "Vivero certificador de alta producción",
    descripcion:
      "Vivero certificador cuya producción anual o superficie supera los topes de la subcategoría de baja producción.",
  },
  K: {
    nombre: "Vivero identificador",
    descripcion:
      "Identifica plantas y/o partes de su propia producción o adquiridas a terceros. Habilitado para comercializar su producción. En el padrón siempre aparece con su subcategoría de tamaño (K1 o K2).",
  },
  K1: {
    nombre: "Vivero identificador de baja producción",
    descripcion:
      "Vivero identificador cuya producción anual no supera las 100.000 unidades (con topes específicos para ajo y forestales).",
  },
  K2: {
    nombre: "Vivero identificador de alta producción",
    descripcion:
      "Vivero identificador cuya producción anual o superficie supera los topes de la subcategoría de baja producción.",
  },
  N: {
    nombre: "Operador de especies nativas",
    descripcion:
      "Realiza fitomejoramiento, multiplica, comercializa, exporta, importa, procesa para sí mismo, identifica o entrega a cualquier título semillas y/o material de propagación de especies nativas.",
  },
  O: {
    nombre: "Operador de OVGM",
    descripcion:
      "Experimenta, importa, exporta, produce, multiplica y/o realiza cualquier actividad con Organismos Vegetales Genéticamente Modificados no autorizados para su comercialización en la República Argentina.",
  },
  P: {
    nombre: "Mantenedor de pureza varietal",
    descripcion:
      "Lleva adelante el proceso de mantenimiento de pureza varietal de cultivares de uso público inscriptos en el Registro Nacional de Cultivares. Habilitado a comercializar la producción.",
  },
};

export const CATEGORIAS_PDF_URL =
  "https://www.argentina.gob.ar/sites/default/files/inase-categorias_rncyfs_v09-24.pdf";

/**
 * Look up a category code.
 *
 * Returns null for anything unknown so callers render the bare code instead of
 * a guess: INASE can add categories, and inventing a meaning would tell someone
 * a seller is authorised for something they are not.
 */
export function categoriaInfo(codigo: string): CategoriaInfo | null {
  return CATEGORIAS_RNCYFS[codigo?.toUpperCase()] ?? null;
}
