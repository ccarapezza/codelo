// Tareas programadas propias del vertical.
//
// El motor las toma con un spread en config/cron-tasks.ts, así que ese archivo
// no cambia por agregar una acá. Un proyecto sin tareas propias deja el objeto
// vacío, como está ahora.
//
// Ejemplo de lo que va acá: sincronizar un registro público, traer normativa,
// consultar una API del sector. Cada tarea es `{ task, options: { rule, tz } }`
// igual que las del motor.

export const verticalCronTasks = {};
