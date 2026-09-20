// Home del admin — datos de sistema/crons (sólo lectura). Auth vía requireAdmin
// dentro del controller (admin/editor/author), por eso `auth: false` acá salta
// la cadena de users-permissions.
export default {
  routes: [
    {
      method: "GET",
      path: "/dashboard/boletin",
      handler: "api::dashboard.dashboard.boletin",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/dashboard/inase",
      handler: "api::dashboard.dashboard.inase",
      config: { auth: false },
    },
  ],
};
