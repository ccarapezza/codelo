import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Use these in place of
 * `next/link` and `next/navigation` whenever a route should be
 * resolved within the active locale (i.e., everywhere outside of
 * `/api`). `Link`, `redirect`, `useRouter`, `usePathname` all prefix
 * the URL with the current locale automatically.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
