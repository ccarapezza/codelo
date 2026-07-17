"use client";

import { useSyncExternalStore } from "react";
import { getBrowserTimeZone } from "@/lib/intl";

// The visitor's timezone doesn't change within a session → nothing to
// subscribe to (no-op store).
const subscribe = () => () => {};

/**
 * Returns the timezone to render times in: `serverZone` during SSR and the
 * first hydration render (so server and client markup match), then the
 * visitor's *device* timezone afterwards. Built on `useSyncExternalStore` so
 * there's no hydration mismatch and no setState-in-effect — React swaps to the
 * client snapshot right after commit.
 *
 * Pass the locale reference zone (`localeTimeZone(locale)`) as `serverZone`.
 */
export function useLocalZone(serverZone: string): string {
  return useSyncExternalStore(
    subscribe,
    getBrowserTimeZone,
    () => serverZone,
  );
}
