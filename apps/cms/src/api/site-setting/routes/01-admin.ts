// Admin-only routes. Auth is enforced inside each controller via the
// requireAdmin() helper. `auth: false` skips the users-permissions chain.
const ADMIN_ROUTE = { auth: false };

export default {
  routes: [
    {
      method: "GET",
      path: "/site-setting/admin-config",
      handler: "api::site-setting.site-setting.adminFind",
      config: ADMIN_ROUTE,
    },
    {
      method: "PUT",
      path: "/site-setting/admin-config",
      handler: "api::site-setting.site-setting.adminUpdate",
      config: ADMIN_ROUTE,
    },
  ],
};
