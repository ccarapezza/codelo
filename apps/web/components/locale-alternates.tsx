"use client";

import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

// Localized routes (blog posts) have a DIFFERENT path per locale — the slug is
// translated. The LocaleToggle lives in the header (a server layout boundary
// above the page), so the post page publishes its per-locale paths here and the
// toggle reads them to navigate to the right slug instead of reusing the
// current pathname.
//
// Entries are keyed by the pathname they were published for: the toggle only
// uses them while the visitor is still on that page, so nothing needs to be
// "reset" on navigation and there's no effect-ordering race between pages.

export type LocaleAlternates = Partial<Record<Locale, string>>;

type Stored = { pathname: string; alternates: LocaleAlternates };

type ContextValue = {
  stored: Stored | null;
  setStored: (s: Stored) => void;
};

const LocaleAlternatesContext = createContext<ContextValue | null>(null);

export function LocaleAlternatesProvider({ children }: { children: React.ReactNode }) {
  const [stored, setStored] = useState<Stored | null>(null);
  const value = useMemo(() => ({ stored, setStored }), [stored]);
  return (
    <LocaleAlternatesContext.Provider value={value}>
      {children}
    </LocaleAlternatesContext.Provider>
  );
}

/** Per-locale paths for the CURRENT page, or null when the page didn't publish
 *  any (every locale shares the pathname — the default for most routes). */
export function useLocaleAlternates(): LocaleAlternates | null {
  const ctx = useContext(LocaleAlternatesContext);
  const pathname = usePathname();
  if (!ctx?.stored) return null;
  return ctx.stored.pathname === pathname ? ctx.stored.alternates : null;
}

/** Rendered (as null) by pages whose path differs per locale. `alternates` maps
 *  locale → path WITHOUT the locale prefix, e.g. { es: "/blog/hola", en: "/blog/hello" }. */
export function SetLocaleAlternates({ alternates }: { alternates: LocaleAlternates }) {
  const ctx = useContext(LocaleAlternatesContext);
  const pathname = usePathname();
  const serialized = JSON.stringify(alternates);
  const setStored = ctx?.setStored;

  useEffect(() => {
    if (!setStored) return;
    setStored({ pathname, alternates: JSON.parse(serialized) as LocaleAlternates });
  }, [setStored, pathname, serialized]);

  return null;
}
