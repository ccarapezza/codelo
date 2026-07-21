// Admin-only routes. Auth enforced inside the controller via requireAdmin().
// Internal routes use a shared-secret header (x-internal-key) checked inside
// the controller — same pattern as the other internal admin endpoints.
export default {
  routes: [
    {
      method: "POST",
      path: "/post/generate-cover",
      handler: "api::post.post.generateCover",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post/regenerate-cover-internal",
      handler: "api::post.post.regenerateCoverInternal",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post/generate-carousel",
      handler: "api::post.post.generateCarousel",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post/translate",
      handler: "api::post.post.translate",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post/translate-backfill",
      handler: "api::post.post.translateBackfill",
      config: { auth: false },
    },
    // Manual news generator (admin "Generador de notas"). Synchronous endpoints
    // hosted on the post controller (it already imports the whole pipeline).
    {
      method: "POST",
      path: "/news-generator/generate",
      handler: "api::post.post.newsGenerate",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/news-generator/refine",
      handler: "api::post.post.newsRefine",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/news-generator/image",
      handler: "api::post.post.newsImage",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/news-generator/save",
      handler: "api::post.post.newsSave",
      config: { auth: false },
    },
  ],
};
