// Estado de la puesta en marcha, para el widget de la home.
//
// No es un content-type: no hay nada que guardar, sólo mirar cómo está la
// instalación. Se exporta como factory —`({ strapi }) => ({…})`— y no como
// objeto plano: con un objeto plano Strapi no registra la ruta y el endpoint
// responde 404 sin un solo error en el log (mismo patrón que api/usage).
import { requireAdmin } from "../../../lib/admin-auth";
import { getSetupStatus } from "../../../lib/setup-status";

export default ({ strapi }: { strapi: any }) => ({
  async status(ctx: any) {
    if (!(await requireAdmin(ctx, strapi))) return;
    ctx.body = await getSetupStatus(strapi);
  },
});
