import type { CmsSiteSettings } from "./cms";

// GA4 Measurement IDs look like `G-XXXXXXXXXX` (uppercase alphanumerics).
const GA_ID_RE = /^G-[A-Z0-9]{6,}$/;

const isValidGaId = (value: string | null): value is string =>
  typeof value === "string" &&
  GA_ID_RE.test(value) &&
  !/^G-X+$/.test(value); // reject the `G-XXXXXXXXXX` placeholder

/**
 * Returns the configured GA4 Measurement ID if it's a valid, non-placeholder
 * id; otherwise null. Mirrors `isValidPublisherId` in `lib/adsense.ts`.
 */
export function resolveGaId(settings: CmsSiteSettings): string | null {
  return isValidGaId(settings.googleAnalyticsId) ? settings.googleAnalyticsId : null;
}

// Microsoft Clarity project IDs are short alphanumeric tokens (e.g. "k8f3j2x9a1").
const CLARITY_ID_RE = /^[a-z0-9]{4,20}$/i;

/** Returns the configured Microsoft Clarity project id if valid; otherwise null. */
export function resolveClarityId(settings: CmsSiteSettings): string | null {
  const v = settings.clarityProjectId?.trim();
  return v && CLARITY_ID_RE.test(v) ? v : null;
}
