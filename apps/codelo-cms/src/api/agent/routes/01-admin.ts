// Admin-only routes. Auth is enforced INSIDE each controller via the
// requireAdmin() helper (lib/admin-auth). `auth: false` here skips the
// users-permissions auth chain so the controller body always runs.
const ADMIN_ROUTE = { auth: false };

export default {
  routes: [
    {
      method: "POST",
      path: "/agent/run-now",
      handler: "api::agent.agent.runNow",
      config: ADMIN_ROUTE,
    },
    {
      method: "POST",
      path: "/agent/preview-batch",
      handler: "api::agent.agent.previewBatch",
      config: ADMIN_ROUTE,
    },
    {
      method: "POST",
      path: "/agent/run-batch",
      handler: "api::agent.agent.runBatch",
      config: ADMIN_ROUTE,
    },
    {
      method: "GET",
      path: "/agent/image-generator",
      handler: "api::agent.agent.getImageGenerator",
      config: ADMIN_ROUTE,
    },
  ],
};
