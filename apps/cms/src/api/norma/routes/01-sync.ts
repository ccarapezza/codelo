// Disparos manuales del vigilante normativo. Auth adentro del controller
// (x-internal-key o sesión de admin), por eso `auth: false` acá.
//
// El prefijo numérico ordena la carga: estas rutas tienen que registrarse antes
// que el core router, que si no se queda con /normas/:documentId.
export default {
  routes: [
    {
      method: "POST",
      path: "/boletin/sync",
      handler: "api::norma.norma.syncAhora",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/boletin/reanalizar",
      handler: "api::norma.norma.reanalizar",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/boletin/reanalizar/:documentId",
      handler: "api::norma.norma.reanalizar",
      config: { auth: false },
    },
  ],
};
