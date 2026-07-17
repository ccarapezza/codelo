import { defineRouting } from "next-intl/routing";

/**
 * Canonical routing config for next-intl. All UI routes live under
 * `app/[lang]/...`. `app/api/*` and `app/ads.txt` stay at the root and
 * are excluded by the middleware matcher.
 *
 * - `localePrefix: "always"` → every URL has a locale segment
 *   (`/es/...`, `/en/...`). No "default at root" exception, to keep
 *   canonical URLs unambiguous for SEO and caching.
 */
// ES-only for now: the association's audience is local. Adding a locale later
// is just extending this array + adding its messages bundle.
export const routing = defineRouting({
  locales: ["es"],
  defaultLocale: "es",
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
