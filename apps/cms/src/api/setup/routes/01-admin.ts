// Ruta sólo del panel. La auth la hace el controller con requireAdmin();
// `auth: false` saltea la cadena de users-permissions.
export default {
  routes: [
    {
      method: "GET",
      path: "/setup/status",
      handler: "api::setup.setup.status",
      config: { auth: false },
    },
  ],
};
