// Social Studio — admin-only routes. Auth enforced inside the controller via
// requireAdmin() (same pattern as the post admin routes): the admin panel's
// useFetchClient sends the admin Bearer token automatically.
export default {
  routes: [
    {
      method: "GET",
      path: "/social-studio/config",
      handler: "api::social-studio.social-studio.config",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/social-studio/backgrounds",
      handler: "api::social-studio.social-studio.backgrounds",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/social-studio/generate",
      handler: "api::social-studio.social-studio.generate",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/social-studio/jobs/:jobId",
      handler: "api::social-studio.social-studio.jobStatus",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/social-studio/jobs/:jobId/video",
      handler: "api::social-studio.social-studio.jobVideo",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/social-studio/render-preview",
      handler: "api::social-studio.social-studio.renderPreview",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/social-studio/save",
      handler: "api::social-studio.social-studio.save",
      config: { auth: false },
    },
  ],
};
