import { Link } from "@/i18n/navigation";
import { ScanQrCode, Building2, Sprout, FileText } from "lucide-react";
import { getCultivares, getOperadoresTotal } from "@/lib/semillas";

/**
 * INASE lookups as a rail module.
 *
 * The wide version of this banner ran edge to edge and broke the page's rhythm;
 * stacked in the rail it reads as one more standing service, next to the
 * Boletín and the agenda — which is what it is.
 *
 * Carries the real counts rather than an adjective: "67 cultivares · 3.032
 * operadores" says what the tool is far better than "consultá los registros
 * oficiales" does, and stays honest because the numbers come from the same
 * mirror the pages read.
 *
 * Fail-soft like every other fetcher here: with the CMS unreachable the module
 * still renders its links, just without the figures.
 */
export async function SemillasRail() {
  const [cultivares, operadores] = await Promise.all([getCultivares(), getOperadoresTotal()]);

  const enlaces = [
    {
      href: "/semillas/leer",
      icono: ScanQrCode,
      titulo: "Leer un rótulo",
      bajada: "Escaneá la estampilla o cargá el cultivar y el número de inscripción.",
    },
    {
      href: "/semillas/operadores",
      icono: Building2,
      titulo: "Verificar una inscripción",
      bajada: "Si un operador figura en el RNCyFS y para qué actividades está habilitado.",
    },
    {
      href: "/semillas/rotulo",
      icono: FileText,
      titulo: "Cómo leer un rótulo",
      bajada: "Los campos que exige la ley y cuáles podés verificar por tu cuenta.",
    },
  ] as const;

  return (
    <section aria-label="Consulta de registros de semillas" className="boletin-panel px-6 py-7">
      <p className="label flex items-center gap-2 text-ember">
        <Sprout className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
        Registros de INASE
      </p>
      <h2 className="boletin-title mt-2 font-display text-3xl leading-none font-semibold">
        Semillas
      </h2>
      <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
        Espejamos el Catálogo Nacional de Cultivares y el padrón de operadores para que puedas
        verificar un rótulo sin pelear con la web oficial.
      </p>

      {/* Las cifras van antes que los enlaces: son lo que dice de qué tamaño es
          la herramienta, y se leen de un vistazo. */}
      {cultivares.length > 0 || operadores ? (
        <dl className="mt-5 flex gap-x-8 border-t border-rule pt-4">
          {cultivares.length > 0 ? (
            <div>
              <dd className="font-display text-2xl leading-none font-semibold">
                {cultivares.length}
              </dd>
              <dt className="label mt-1.5 text-muted-foreground">Cultivares</dt>
            </div>
          ) : null}
          {operadores ? (
            <div>
              <dd className="font-display text-2xl leading-none font-semibold">
                {operadores.toLocaleString("es-AR")}
              </dd>
              <dt className="label mt-1.5 text-muted-foreground">Operadores</dt>
            </div>
          ) : null}
        </dl>
      ) : null}

      <ul className="mt-5 border-t border-rule">
        {enlaces.map(e => {
          const Icono = e.icono;
          return (
            <li key={e.href} className="border-b border-rule">
              <Link href={e.href} className="group flex gap-3 py-3.5">
                <Icono
                  className="mt-0.5 size-4 shrink-0 text-ember"
                  aria-hidden
                  strokeWidth={1.75}
                />
                <div className="min-w-0">
                  <p className="font-serif text-sm leading-snug font-semibold group-hover:text-ember">
                    {e.titulo}
                  </p>
                  <p className="mt-0.5 font-serif text-xs leading-snug text-muted-foreground">
                    {e.bajada}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href="/semillas" className="label mt-5 inline-block text-ember hover:underline">
        Ver todo el registro →
      </Link>
    </section>
  );
}
