// Admin-only routes. Auth is enforced inside each controller via the
// requireAdmin() helper. `auth: false` skips the users-permissions chain.
const ADMIN_ROUTE = { auth: false };

export default {
  routes: [
    {
      method: "GET",
      path: "/rss-feed/admin-status",
      handler: "api::rss-feed.rss-feed.adminStatus",
      config: ADMIN_ROUTE,
    },
    // CRUD que reemplaza al del Content Manager (el tipo está oculto ahí).
    // `admin-list` y no `admin` a secas para no chocar con el core router.
    {
      method: "GET",
      path: "/rss-feed/admin-list",
      handler: "api::rss-feed.rss-feed.adminList",
      config: ADMIN_ROUTE,
    },
    {
      method: "POST",
      path: "/rss-feed/admin-create",
      handler: "api::rss-feed.rss-feed.adminCreate",
      config: ADMIN_ROUTE,
    },
    {
      method: "PUT",
      path: "/rss-feed/admin-update/:documentId",
      handler: "api::rss-feed.rss-feed.adminUpdate",
      config: ADMIN_ROUTE,
    },
    {
      method: "DELETE",
      path: "/rss-feed/admin-delete/:documentId",
      handler: "api::rss-feed.rss-feed.adminDelete",
      config: ADMIN_ROUTE,
    },
    {
      method: "POST",
      path: "/rss-feed/fetch-now",
      handler: "api::rss-feed.rss-feed.fetchNow",
      config: ADMIN_ROUTE,
    },
    {
      method: "POST",
      path: "/rss-feed/validate",
      handler: "api::rss-feed.rss-feed.validate",
      config: ADMIN_ROUTE,
    },
  ],
};
