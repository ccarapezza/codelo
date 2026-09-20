import { factories } from "@strapi/strapi";
import { requireAdmin } from "../../../lib/admin-auth";
import { syncBoletinOficial } from "../../../lib/boletin-oficial";

/** Same shared-secret check the other internal endpoints use. */
function verifyInternalKey(ctx: any): boolean {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = ctx.request.headers["x-internal-key"];
  return typeof provided === "string" && provided === expected;
}

export default factories.createCoreController("api::norma.norma", ({ strapi }) => ({
  /**
   * Corrida manual del vigilante normativo.
   *
   * El cron de las 07:15 es el camino normal; esto existe para sembrar un
   * entorno nuevo (la tabla arranca vacía y el riel de la home quedaría vacío
   * hasta el día siguiente) y para reintentar después de un fallo. A diferencia
   * del cron, los errores salen como 502 en vez de tragarse: ese es el punto de
   * tener un disparo manual.
   *
   * Acepta `x-internal-key` (scripts, deploy) o sesión de admin (el botón del
   * widget), porque se usa desde los dos lados.
   */
  async syncAhora(ctx: any) {
    if (!verifyInternalKey(ctx) && !(await requireAdmin(ctx, strapi))) return;
    try {
      ctx.body = await syncBoletinOficial(strapi, { sinceDays: 7 });
    } catch (err) {
      strapi.log.error("[boletin-oficial] sync manual falló:", err);
      ctx.status = 502;
      ctx.body = { error: (err as Error).message };
    }
  },

  /**
   * Vuelve a poner una norma en la cola de análisis.
   *
   * Para cuando se calibra la escala de relevancia desde la página de Prompts:
   * la norma ya está archivada con su texto, así que re-analizarla no vuelve a
   * tocar el Boletín. Sin `documentId` re-encola todas las descartadas, que es
   * lo que se quiere después de aflojar el criterio.
   *
   * Acepta las dos autenticaciones por la misma razón que el sync: calibrar es
   * un ciclo de editar-el-prompt / re-analizar / mirar, y se hace tanto desde
   * el botón del widget como desde un script.
   */
  async reanalizar(ctx: any) {
    if (!verifyInternalKey(ctx) && !(await requireAdmin(ctx, strapi))) return;
    const documentId = ctx.params?.documentId as string | undefined;
    // `?todas=1` re-encola TAMBIÉN las ya publicadas. Es lo que hace falta al
    // cambiar una regla de extracción (que afecta a toda ficha, no sólo a las
    // descartadas), pero cuesta una llamada por norma archivada — por eso no es
    // el default ni está en el botón del widget.
    //
    // Ojo: mientras están en cola, esas normas salen de /normativa (la web sólo
    // muestra `listo`). En la práctica no se nota porque la web cachea 300 s y
    // el re-análisis tarda segundos, pero por eso conviene correrlo junto con
    // el sync y no dejarlo a medias.
    const todas = ctx.query?.todas !== undefined;

    // El tipo explícito es necesario: sin él TS ensancha el array a string[] y
    // no matchea el enum de `analisisEstado`.
    const reencolables: Array<"descartada" | "error"> = ["descartada", "error"];
    const filters = documentId
      ? { documentId }
      : todas
        ? {}
        : { analisisEstado: { $in: reencolables } };
    const rows = (await strapi
      .documents("api::norma.norma")
      .findMany({ filters, fields: ["url"], limit: -1 })) as unknown as Array<{
      documentId: string;
    }>;

    for (const row of rows) {
      await strapi.documents("api::norma.norma").update({
        documentId: row.documentId,
        data: { analisisEstado: "pendiente", analisisError: null },
      });
    }

    ctx.body = { encoladas: rows.length };
  },
}));
