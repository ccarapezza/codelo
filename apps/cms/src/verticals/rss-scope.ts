// Alcance editorial del vertical: qué ítems del pool de RSS son del tema de
// este sitio y cuáles son ruido de los feeds generalistas.
//
// Esto es una COSTURA: el mecanismo que consume estas listas vive en
// `lib/rss-fetcher.ts` (isEditoriallyRelevant) y es igual en todos los
// proyectos; lo que cambia por sitio son las palabras, y viven acá.
//
// Con las cuatro listas vacías el filtro deja pasar todo, que es el
// comportamiento actual de codelo: los redactores filtran por `agent.topic`
// dentro de la consulta a news-context, así que el pool que ven ya es del tema.
//
// Dónde hace falta llenarlas: `planBatch()` arma el pool con topic vacío y
// reparte lo que haya entre los redactores. Con feeds generalistas ([AR]
// Infobae, Clarín, La Nación, Perfil) eso produjo 26 borradores sobre Messi,
// Matt Damon y el Día Mundial del Perro. Completar `scope` es lo que haría a
// `/api/agent/run-batch` usable sin apagar esos feeds (ver CLAUDE.md).

/**
 * Términos inequívocos del vertical: alcanza con que uno aparezca como palabra
 * completa para considerar el ítem relevante. Sólo formas distintivas —una
 * palabra ambigua va en `ambiguous`.
 */
export const scope: readonly string[] = [];

/**
 * Términos que también son palabras comunes o nombres ajenos, y que sólo
 * cuentan si además aparece alguna pista de `contextCues`. Evita que un ítem
 * entre por una colisión de nombre.
 */
export const ambiguous: readonly string[] = [];

/** Pistas que confirman que un término ambiguo es del tema. */
export const contextCues: readonly string[] = [];

/**
 * Exclusión dura: si aparece alguno, el ítem se descarta aunque haya matcheado.
 * Para temas que los mismos feeds mezclan y no son de este sitio.
 */
export const denylist: readonly string[] = [];
