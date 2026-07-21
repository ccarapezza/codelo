import { categoriaInfo, CATEGORIAS_PDF_URL } from "@/lib/categorias-rncyfs";

/**
 * Renders an operator's RNCyFS categories with their official meaning.
 *
 * A code alone ("EFK1") is unreadable; the name is what actually answers "what
 * is this place allowed to do?". Unknown codes fall back to the bare code —
 * INASE can add categories, and a guess here would assert an authorisation the
 * operator may not hold.
 */
export function Categorias({
  codigos,
  label,
  sourceLabel,
  help,
}: {
  codigos: string[];
  label: string;
  sourceLabel: string;
  /** Species-scope caveat. Without it, a category reads as blanket permission. */
  help?: string;
}) {
  if (!codigos?.length) return null;

  return (
    <div>
      <p className="label text-muted-foreground">{label}</p>
      <ul className="mt-2 space-y-2">
        {codigos.map(codigo => {
          const info = categoriaInfo(codigo);
          return (
            <li key={codigo} className="flex gap-2.5">
              <span className="label mt-0.5 shrink-0 border border-rule px-1.5 py-0.5 text-ink">
                {codigo}
              </span>
              <div className="min-w-0">
                {info ? (
                  <>
                    <p className="font-serif text-base leading-snug font-semibold">{info.nombre}</p>
                    <p className="mt-0.5 font-serif text-sm leading-relaxed text-muted-foreground">
                      {info.descripcion}
                    </p>
                  </>
                ) : (
                  <p className="font-serif text-base text-muted-foreground">
                    Categoría no reconocida. Consultá la referencia oficial.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {help ? (
        <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">{help}</p>
      ) : null}
      <a
        href={CATEGORIAS_PDF_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="label mt-2 inline-block text-ember hover:underline"
      >
        {sourceLabel}
      </a>
    </div>
  );
}
