// Admin-only routes. Auth is enforced inside each controller via the
// requireAdmin() helper. `auth: false` skips the users-permissions chain.
const ADMIN_ROUTE = { auth: false };

export default {
  routes: [
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
