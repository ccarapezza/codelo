// Admin-only audit list. Auth via requireAdmin inside the controller.
export default {
  routes: [
    {
      method: "GET",
      path: "/agent-action/admin-list",
      handler: "api::agent-action.agent-action.adminList",
      config: { auth: false },
    },
  ],
};
