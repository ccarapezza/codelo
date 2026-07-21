"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { Cultivar } from "@/lib/semillas";

/** Cuántas filas se muestran antes de pedir el resto. */
const LIMITE = 8;

/**
 * Client-side filter over the whole cultivar list.
 *
 * There are 67 of them, so shipping the set and filtering in the browser is
 * cheaper and far more responsive than a round trip per keystroke.
 */
export function CultivaresBrowser({
  cultivares,
  labels,
}: {
  cultivares: Cultivar[];
  labels: {
    search: string;
    count: string;
    empty: string;
    registro: string;
    obtentor: string;
    altaRnc: string;
    sinRnc: string;
    verTodos: string;
    verMenos: string;
  };
}) {
  const [query, setQuery] = useState("");
  const [verTodos, setVerTodos] = useState(false);

  const normalized = useMemo(
    () =>
      cultivares.map(c => ({
        cultivar: c,
        haystack: fold(
          [c.nombre, c.especie, c.solicitanteRnc, c.solicitanteRnpc, String(c.numeroRegistro)]
            .filter(Boolean)
            .join(" "),
        ),
      })),
    [cultivares],
  );

  const results = useMemo(() => {
    const q = fold(query);
    if (!q) return cultivares;
    return normalized.filter(n => n.haystack.includes(q)).map(n => n.cultivar);
  }, [query, normalized, cultivares]);

  // Con 67 cultivares la lista completa era el 74 % de la página. Se muestran
  // los primeros y el resto se pide: quien busca algo concreto usa el buscador,
  // y quien quiere el catálogo entero lo despliega de una.
  const visibles = verTodos ? results : results.slice(0, LIMITE);
  const ocultos = results.length - visibles.length;

  return (
    <div>
      <label className="relative mt-6 block max-w-xl">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={labels.search}
          aria-label={labels.search}
          className="w-full rounded-none border border-rule bg-transparent py-2.5 pr-3 pl-9 font-serif text-base placeholder:text-muted-foreground focus:border-ember focus:outline-none"
        />
      </label>

      {/* El número se compone acá, no en el mensaje: next-intl interpreta
          `{count}` como placeholder ICU y, sin la variable, lo deja vacío. */}
      <p className="label mt-3 text-muted-foreground">
        {results.length} {labels.count}
      </p>

      {results.length === 0 ? (
        <p className="mt-8 font-serif text-lg text-muted-foreground">{labels.empty}</p>
      ) : (
        <>
          {/* Fila de dos líneas, no de cinco. La versión anterior daba a cada
              cultivar un bloque de 137 px con el número en cuerpo 24 y cada
              dato en su renglón: 67 filas ocupaban 9.179 px, el 74 % de la
              página. Acá el nombre manda y el resto va de corrido en una línea
              de metadatos; la ficha sigue teniendo todo. */}
          <ul className="mt-4 border-t border-rule">
            {visibles.map(c => (
              <li key={c.numeroRegistro} className="border-b border-rule">
                <Link
                  href={`/semillas/${c.numeroRegistro}`}
                  className="group grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-x-4 py-2.5 hover:bg-muted/40 sm:grid-cols-[4rem_minmax(0,1fr)]"
                >
                  <span
                    className="label text-right text-muted-foreground"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {c.numeroRegistro}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-serif text-base leading-snug font-semibold group-hover:text-ember">
                      {c.nombre}
                    </span>
                    <span className="label mt-0.5 block truncate text-muted-foreground">
                      {[
                        c.especie,
                        c.codPais,
                        c.solicitanteRnc,
                        c.inscripcionRnc ? formatDate(c.inscripcionRnc) : labels.sinRnc,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* El buscador es la vía principal; la lista completa se pide. */}
          {ocultos > 0 || verTodos ? (
            <button
              type="button"
              onClick={() => setVerTodos(v => !v)}
              className="label mt-4 border border-rule px-4 py-2 text-ember hover:border-ember"
            >
              {verTodos ? labels.verMenos : `Ver ${ocultos} ${labels.verTodos}`}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Same folding as the CMS side, so an accent-free query matches damaged rows. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}
