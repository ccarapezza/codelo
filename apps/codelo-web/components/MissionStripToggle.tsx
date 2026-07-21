"use client";

import { useId, useState } from "react";
import { ChevronDown, Sprout } from "lucide-react";

/**
 * Collapses the INASE lookups behind a button — on phones only.
 *
 * Even compacted the strip ate ~118 px above the fold, which on a 390 px screen
 * is a real slice of the front page. Collapsed it costs one line; open, it is
 * the same content as always.
 *
 * From `sm` up the button disappears and the panel is permanently visible, so
 * desktop never sees the collapsed state. The `hidden`/`sm:block` pair does the
 * work: `display:none` also hides it from assistive tech, so nothing announces
 * a panel that is not there.
 */
export function MissionStripToggle({
  children,
  resumen,
}: {
  children: React.ReactNode;
  resumen: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        aria-expanded={abierto}
        aria-controls={id}
        className="flex w-full items-center gap-2 py-1.5 text-left sm:hidden"
      >
        <Sprout className="size-4 shrink-0 text-ember" aria-hidden strokeWidth={1.75} />
        <span className="flex-1 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-ember uppercase">
          {resumen}
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
            abierto ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      <div id={id} className={`${abierto ? "block" : "hidden"} sm:block`}>
        {children}
      </div>
    </>
  );
}
