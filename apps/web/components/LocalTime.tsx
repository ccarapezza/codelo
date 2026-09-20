"use client";

import { useLocalZone } from "@/hooks/useLocalZone";
import type { Locale } from "@/i18n/routing";
import { formatKind, formatTimeZoneLabel, localeTimeZone, type LocalTimeKind } from "@/lib/intl";

/**
 * Renders a kickoff time in the visitor's *device* timezone.
 *
 * The server renders the locale reference zone (e.g. "16:00 ART"); after
 * hydration the component swaps to the browser zone (e.g. "21:00 CEST"). The
 * `useLocalZone` hook drives this with no hydration mismatch — see its docs.
 *
 * For `kind="kickoffDate"`/`"match"`/`"matchZoned"` the date is re-resolved in
 * the local zone too, so a kickoff that crosses midnight shows the correct day.
 * `kind="zoneLabel"` renders just the local zone label.
 */
export function LocalTime({
  iso,
  locale,
  kind,
  withZone = false,
  className,
}: {
  iso: string;
  locale: Locale;
  kind: LocalTimeKind;
  /** Append the resolved local zone label (e.g. " CEST"). Ignored for "zoneLabel". */
  withZone?: boolean;
  className?: string;
}) {
  const zone = useLocalZone(localeTimeZone(locale));

  let text = formatKind(iso, locale, kind, zone);
  if (withZone && kind !== "zoneLabel") {
    const label = formatTimeZoneLabel(iso, locale, zone);
    if (label) text += ` ${label}`;
  }

  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
