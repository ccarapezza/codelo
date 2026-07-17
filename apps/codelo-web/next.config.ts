import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// next-intl reads request config from this path (locale resolution +
// message bundle loader). See `i18n/request.ts`.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// `async rewrites()` is evaluated once at `next build` time and the
// resulting URL is baked into the standalone server — there is no
// runtime indirection. CMS_URL is only set in the runtime container,
// not in the build container, so reading it from rewrites() will not
// help. Instead, branch on NODE_ENV (which IS available at build time)
// and pick the upstream that matches the deploy target.
function resolveCmsUpstream(): string {
  if (process.env.NODE_ENV === "production") {
    // Inside the production docker network the CMS is reachable at the
    // service hostname. CMS_URL in compose mirrors this; override only
    // if someone explicitly sets a different one at build time.
    return (process.env.CMS_URL ?? "http://cms:1337").replace(/\/$/, "");
  }
  return (
    process.env.CMS_URL ??
    process.env.NEXT_PUBLIC_CMS_URL ??
    "http://localhost:1339"
  ).replace(/\/$/, "");
}

const isProd = process.env.NODE_ENV === "production";

// CSP: AdSense + Next inline scripts force 'unsafe-inline' for now. Tighten
// with a nonce middleware later.
//
// AdSense pulls scripts/iframes from several Google hosts beyond the loader:
//   - *.googlesyndication.com    → adsbygoogle loader (pagead2) + safeframe/tpc creatives
//   - adservice.google.com       → ad serving
//   - fundingchoicesmessages.…   → the Funding Choices consent CMP (script + dialog iframe)
//   - tpc / *.safeframe.…        → the creative iframes (frame-src)
// Missing any of these makes the ad slot fail to fill or render a blocked
// (broken) iframe — which is what was breaking the Hero's mobile banner.
// www.clarity.ms is the Microsoft Clarity tag loader.
const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googlesyndication.com https://adservice.google.com https://www.googletagservices.com https://www.googletagmanager.com https://fundingchoicesmessages.google.com https://www.clarity.ms",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.safeframe.googlesyndication.com https://www.google.com https://fundingchoicesmessages.google.com",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Content-Security-Policy", value: cspDirectives },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  // Standalone output bundles a self-contained server.js for the Docker image.
  // See: https://nextjs.org/docs/app/api-reference/next-config-js/output
  output: "standalone",
  poweredByHeader: false,
  // Only blog covers go through the optimizer (same-origin /cms proxy). External
  // player headshots are NOT optimized — Wikimedia 403s the optimizer's fetch and
  // only serves a few bucket widths — so PlayerAvatar uses a plain <img> and no
  // remotePatterns are needed.
  images: {
    formats: ["image/avif", "image/webp"],
    // Strapi proxies blog covers with cache-control: max-age=0; cache the
    // optimized output for a week (filenames are content-hashed, so it's safe).
    minimumCacheTTL: 604800,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
    ];
  },
  async rewrites() {
    // Proxy CMS assets (and any other path) through the Next host so the
    // browser only ever talks to the public origin. Lets the site work behind
    // tunnels / single-domain deployments without exposing Strapi separately.
    const cmsUpstream = resolveCmsUpstream();
    return [
      { source: "/cms/:path*", destination: `${cmsUpstream}/:path*` },
    ];
  },
};

export default withNextIntl(nextConfig);
