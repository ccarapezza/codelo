"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Global top progress bar for internal navigations. App Router route changes hit
 * the server before the page swaps, with no built-in feedback — so a click (e.g.
 * the logo → home) can look dead for a second on a heavy page. We catch internal
 * link clicks to start the bar and finish it when the pathname actually changes.
 *
 * Click-driven (covers <a>/<Link> clicks, the common case); programmatic
 * router.push and back/forward don't start it, which is fine — they stay hidden.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (or just a hash) → no navigation.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (resetTimer.current) clearTimeout(resetTimer.current);
      setActive(true);
      setWidth(0);
      // Two RAFs so the 0%→90% trickle animates from 0 instead of snapping.
      requestAnimationFrame(() => requestAnimationFrame(() => setWidth(90)));
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Finish when the route actually changes.
  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect -- intentional: drive the
       completion animation in response to the route change */
    setWidth(100);
    resetTimer.current = setTimeout(() => {
      setActive(false);
      setWidth(0);
    }, 250);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [pathname]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-0.5">
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)] ease-out"
        style={{
          width: `${width}%`,
          opacity: active ? 1 : 0,
          transitionProperty: "width, opacity",
          // Slow trickle to 90%; snap fast when completing or resetting.
          transitionDuration: width === 90 ? "8s" : "250ms",
        }}
      />
    </div>
  );
}
