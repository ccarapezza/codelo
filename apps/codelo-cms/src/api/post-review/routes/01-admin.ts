// Vista de notas (verificar + publicar/despublicar). Auth vía requireAdmin
// dentro del controller (admin/editor/author); `auth: false` salta la cadena
// de users-permissions.
export default {
  routes: [
    {
      method: "GET",
      path: "/post-review/list",
      handler: "api::post-review.post-review.list",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post-review/publish",
      handler: "api::post-review.post-review.publish",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post-review/unpublish",
      handler: "api::post-review.post-review.unpublish",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/post-review/set-featured",
      handler: "api::post-review.post-review.setFeatured",
      config: { auth: false },
    },
    // URL de preview para el panel (requireAdmin dentro del controller).
    {
      method: "GET",
      path: "/post-review/preview-url",
      handler: "api::post-review.post-review.previewUrl",
      config: { auth: false },
    },
    // Contenido del borrador para la web (se autoriza con PREVIEW_SECRET).
    {
      method: "GET",
      path: "/post-review/preview-content",
      handler: "api::post-review.post-review.previewContent",
      config: { auth: false },
    },
  ],
};
