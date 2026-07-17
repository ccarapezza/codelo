export default ({ env }) => [
  "strapi::logger",
  "strapi::errors",
  {
    name: "strapi::security",
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          "connect-src": ["'self'", "https:"],
          "img-src": ["'self'", "data:", "blob:", "https:"],
          "media-src": ["'self'", "data:", "blob:", "https:"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "frame-ancestors": ["'none'"],
          upgradeInsecureRequests: null,
        },
      },
      frameguard: { action: "deny" },
      hsts: env("NODE_ENV") === "production"
        ? { maxAge: 63072000, includeSubDomains: true, preload: true }
        : false,
    },
  },
  {
    name: "strapi::cors",
    config: {
      origin: env.array("CORS_ALLOWED_ORIGINS", ["http://localhost:3000"]),
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      headers: ["Content-Type", "Authorization", "Origin", "Accept", "X-Internal-API-Key"],
    },
  },
  "strapi::poweredBy",
  "strapi::query",
  "strapi::body",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
  {
    name: "global::rate-limit",
    config: {
      windowMs: env.int("RATE_LIMIT_WINDOW_MS", 60_000),
      max: env.int("RATE_LIMIT_MAX", 60),
      pathPrefix: "/api/",
    },
  },
];
