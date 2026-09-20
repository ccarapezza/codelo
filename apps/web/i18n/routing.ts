import { defineRouting } from "next-intl/routing";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/site";

/**
 * Canonical routing config for next-intl. All UI routes live under
 * `app/[lang]/...`. `app/api/*` and `app/ads.txt` stay at the root and
 * are excluded by the middleware matcher.
 *
 * - `localePrefix: "always"` → every URL has a locale segment
 *   (`/es/...`, `/en/...`). No "default at root" exception, to keep
 *   canonical URLs unambiguous for SEO and caching.
 */
// Los idiomas son configuración del sitio, no del motor: viven en lib/site.ts.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];
