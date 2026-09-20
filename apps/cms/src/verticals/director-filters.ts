// Condiciones extra que el Director aplica al elegir borradores para revisar.
//
// Es una COSTURA: el motor las mete en su consulta sin saber qué son. Vacío =
// el Director considera todos los borradores generados por agentes.
//
// Para qué sirve: un vertical puede tener agentes cuyos borradores NO se
// revisan contra noticias —porque se fundan en otra cosa, como estadísticas
// propias— y que el Director rechazaría (y borraría) por no poder verificarlos.
// Excluirlos por un campo es lo que los deja a salvo para revisión humana.

export const extraDirectorFilters: Record<string, unknown> = {};
