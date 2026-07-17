import type { Locale } from "@/i18n/routing";

/**
 * Locale-aware Intl formatters. Centralizes every `new Intl.DateTimeFormat`
 * / `new Intl.NumberFormat` call in the app so the locale is the single
 * source of truth.
 *
 * - `es` maps to BCP47 `es-AR`, `en` to `en-US`.
 * - Every formatter takes an optional explicit `timeZone`. When omitted it
 *   falls back to the locale's reference zone (`TIMEZONE[locale]`) — what the
 *   server renders. Client code resolves the visitor's device zone
 *   (`getBrowserTimeZone`) and passes it explicitly, usually via the
 *   `useLocalZone` hook / `<LocalTime>` component, so a kickoff shows in the
 *   user's own timezone after hydration.
 *
 * Formatters are memoized per (kind, locale, timeZone) tuple.
 */

type Kind =
  | "match" // full kickoff: weekday + day month + HH:mm
  | "matchZoned" // same as "match" but with a short timezone label (ART / EDT)
  | "kickoffDate" // day month
  | "kickoffDay" // weekday + day month ("mar, 16 jun")
  | "kickoffTime" // HH:mm
  | "zoneLabel" // standalone short timezone label (ART / EDT)
  | "shortDate" // day short-month
  | "weekday" // short weekday
  | "weekdayLong" // full weekday
  | "postDate" // day month year
  | "dayHeading"; // "vie · 21 de junio"

const BCP47: Record<Locale, string> = {
  es: "es-AR",
};

const TIMEZONE: Record<Locale, string> = {
  es: "America/Argentina/Buenos_Aires",
};

/** The locale's reference timezone — what the server renders by default. */
export function localeTimeZone(locale: Locale): string {
  return TIMEZONE[locale];
}

/**
 * The visitor's device timezone (client only). Falls back to the es reference
 * zone when Intl can't resolve one (extremely rare). On the server this would
 * return the server's zone, so only call it on the client.
 */
export function getBrowserTimeZone(): string {
  try {
    return (
      Intl.DateTimeFormat().resolvedOptions().timeZone || TIMEZONE.es
    );
  } catch {
    return TIMEZONE.es;
  }
}

const cache = new Map<string, Intl.DateTimeFormat>();
const numberCache = new Map<Locale, Intl.NumberFormat>();

function getDateFormatter(
  kind: Kind,
  locale: Locale,
  timeZone: string = TIMEZONE[locale],
): Intl.DateTimeFormat {
  const key = `${kind}:${locale}:${timeZone}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const bcp47 = BCP47[locale];
  const hour12 = false;

  const options: Intl.DateTimeFormatOptions = (() => {
    switch (kind) {
      case "match":
        return {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
          hour12,
        };
      case "matchZoned":
        return {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
          hour12,
          timeZoneName: "short",
        };
      case "zoneLabel":
        // Only the timeZoneName part is consumed (see formatTimeZoneLabel);
        // hour is required so Intl emits a timeZoneName token at all.
        return {
          hour: "2-digit",
          timeZone,
          hour12,
          timeZoneName: "short",
        };
      case "kickoffDate":
        return {
          day: "2-digit",
          month: "short",
          timeZone,
        };
      case "kickoffDay":
        return {
          weekday: "short",
          day: "numeric",
          month: "short",
          timeZone,
        };
      case "kickoffTime":
        return {
          hour: "2-digit",
          minute: "2-digit",
          timeZone,
          hour12,
        };
      case "shortDate":
        return {
          day: "2-digit",
          month: "short",
          timeZone,
        };
      case "weekday":
        return {
          weekday: "short",
          timeZone,
        };
      case "weekdayLong":
        return {
          weekday: "long",
          timeZone,
        };
      case "postDate":
        return {
          day: "2-digit",
          month: "long",
          year: "numeric",
          timeZone,
        };
      case "dayHeading":
        return {
          weekday: "short",
          day: "numeric",
          month: "long",
          timeZone,
        };
    }
  })();

  const fmt = new Intl.DateTimeFormat(bcp47, options);
  cache.set(key, fmt);
  return fmt;
}

function getNumberFormatter(locale: Locale): Intl.NumberFormat {
  const cached = numberCache.get(locale);
  if (cached) return cached;
  const fmt = new Intl.NumberFormat(BCP47[locale]);
  numberCache.set(locale, fmt);
  return fmt;
}

// ── Day bucketing ─────────────────────────────────────────────────────────

const dayKeyCache = new Map<string, Intl.DateTimeFormat>();

/**
 * Calendar-day key ("YYYY-MM-DD") for the given instant *in `timeZone`*. Used to
 * group fixtures by day. Grouping and the times under each header MUST use the
 * same zone, otherwise a late kickoff lands under the wrong day. `en-CA`
 * conveniently formats as an ISO-style date.
 */
export function dayKey(iso: string, timeZone: string): string {
  let fmt = dayKeyCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    });
    dayKeyCache.set(timeZone, fmt);
  }
  return fmt.format(new Date(iso));
}

// ── Public API ──────────────────────────────────────────────────────────

export function formatMatchDate(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("match", locale, timeZone).format(new Date(iso));
}

/** Full kickoff with a short timezone label appended (e.g. "vie 13 jun, 16:00 ART"). */
export function formatMatchDateZoned(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("matchZoned", locale, timeZone).format(new Date(iso));
}

/** Short timezone label for the given instant ("ART", "EDT", "GMT+9"). */
export function formatTimeZoneLabel(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  const part = getDateFormatter("zoneLabel", locale, timeZone)
    .formatToParts(new Date(iso))
    .find((p) => p.type === "timeZoneName");
  return part?.value ?? "";
}

export function formatKickoff(
  iso: string,
  locale: Locale,
  timeZone?: string,
): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: getDateFormatter("kickoffDate", locale, timeZone).format(d),
    time: getDateFormatter("kickoffTime", locale, timeZone).format(d),
  };
}

export function formatKickoffDate(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("kickoffDate", locale, timeZone).format(new Date(iso));
}

export function formatKickoffTime(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("kickoffTime", locale, timeZone).format(new Date(iso));
}

export function formatShortDate(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("shortDate", locale, timeZone).format(new Date(iso));
}

export function formatWeekday(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("weekday", locale, timeZone).format(new Date(iso));
}

export function formatWeekdayLong(
  iso: string,
  locale: Locale,
  timeZone?: string,
): string {
  return getDateFormatter("weekdayLong", locale, timeZone).format(new Date(iso));
}

export function formatPostDate(iso: string, locale: Locale): string {
  return getDateFormatter("postDate", locale).format(new Date(iso));
}

export function formatDayHeading(
  iso: string,
  locale: Locale,
  timeZone?: string,
): { weekday: string; day: string } {
  const d = new Date(iso);
  return {
    weekday: getDateFormatter("weekday", locale, timeZone).format(d),
    day: getDateFormatter("dayHeading", locale, timeZone).format(d),
  };
}

// ── <LocalTime> support ────────────────────────────────────────────────
// Kinds <LocalTime> can render in an arbitrary (e.g. the visitor's) timezone.

export type LocalTimeKind =
  | "match"
  | "matchZoned"
  | "kickoffDate"
  | "kickoffDay"
  | "kickoffTime"
  | "shortDate"
  | "weekday"
  | "zoneLabel";

/** Format a single kickoff `kind` in `timeZone` (used by <LocalTime>). */
export function formatKind(
  iso: string,
  locale: Locale,
  kind: LocalTimeKind,
  timeZone: string,
): string {
  if (kind === "zoneLabel") return formatTimeZoneLabel(iso, locale, timeZone);
  return getDateFormatter(kind, locale, timeZone).format(new Date(iso));
}

export function formatNumber(n: number, locale: Locale): string {
  return getNumberFormatter(locale).format(n);
}
