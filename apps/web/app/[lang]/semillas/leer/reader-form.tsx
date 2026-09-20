"use client";

import { useCallback, useState } from "react";
import { StampScanner } from "./scanner";

/**
 * The three inputs of the reader, in order of how much they actually prove.
 *
 * Cultivar and RNCyFS number resolve against the mirrored registries. The stamp
 * serial does not resolve against anything — it is captured so people can note
 * it down and quote it, never as a validation.
 */
export function ReaderForm({
  initial,
}: {
  initial: { cultivar?: string; rncyfs?: string; serie?: string };
}) {
  // The serial is the only controlled field: the scanner writes into it.
  // The other two are uncontrolled — a plain GET form submits them as-is.
  const [serie, setSerie] = useState(initial.serie ?? "");

  const onScan = useCallback((text: string) => setSerie(text.trim()), []);

  return (
    <form method="get" className="mt-6 max-w-xl">
      <div className="space-y-4">
        <label className="block">
          <span className="label text-muted-foreground">Nombre del cultivar</span>
          <input
            type="text"
            name="cultivar"
            defaultValue={initial.cultivar ?? ""}
            placeholder="Por ejemplo: Tropicana WFC"
            className="mt-1 w-full rounded-none border border-rule bg-transparent px-3 py-2.5 font-serif text-base placeholder:text-muted-foreground focus:border-ember focus:outline-none"
          />
          <span className="mt-1 block font-serif text-sm text-muted-foreground">
            Aunque lo leas mal, probá igual: buscamos por aproximación.
          </span>
        </label>

        <label className="block">
          <span className="label text-muted-foreground">N° de inscripción RNCyFS</span>
          <input
            type="text"
            name="rncyfs"
            defaultValue={initial.rncyfs ?? ""}
            placeholder="Por ejemplo: 13481EFK1"
            className="mt-1 w-full rounded-none border border-rule bg-transparent px-3 py-2.5 font-serif text-base placeholder:text-muted-foreground focus:border-ember focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="label text-muted-foreground">Serie de la estampilla (opcional)</span>
          <input
            type="text"
            name="serie"
            value={serie}
            onChange={e => setSerie(e.target.value)}
            placeholder="01CAA000254089"
            className="mt-1 w-full rounded-none border border-rule bg-transparent px-3 py-2.5 font-serif text-base tabular-nums placeholder:text-muted-foreground focus:border-ember focus:outline-none"
          />
        </label>

        <StampScanner onResult={onScan} />
      </div>

      <button
        type="submit"
        className="label mt-6 border border-ink bg-ink px-5 py-2.5 text-background hover:opacity-90"
      >
        Consultar
      </button>
    </form>
  );
}
