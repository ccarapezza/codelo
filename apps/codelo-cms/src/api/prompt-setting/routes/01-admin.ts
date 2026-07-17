// Admin-only routes. Auth is enforced inside each controller via the
// requireAdmin() helper. `auth: false` skips the users-permissions chain.
// No base router: this single type has no public find/findOne endpoints.
const ADMIN_ROUTE = { auth: false };

export default {
  routes: [
    {
      method: "GET",
      path: "/prompt-setting/admin-config",
      handler: "api::prompt-setting.prompt-setting.adminFind",
      config: ADMIN_ROUTE,
    },
    {
      method: "PUT",
      path: "/prompt-setting/admin-config",
      handler: "api::prompt-setting.prompt-setting.adminUpdate",
      config: ADMIN_ROUTE,
    },
  ],
};
