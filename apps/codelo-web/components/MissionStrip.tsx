import { Link } from "@/i18n/navigation";
import { ScanQrCode, Building2, Sprout, ArrowUpRight } from "lucide-react";
import { getCultivares, getOperadoresTotal } from "@/lib/semillas";
import { MissionStripToggle } from "./MissionStripToggle";

/** Sitio institucional de INASE — la fuente de todo lo que espeja esta sección. */
const INASE_WEB = "https://www.argentina.gob.ar/inase";

/**
 * The strip under the header: who we are, plus direct access to the INASE
 * lookups.
 *
 * The mission used to take three quiet lines of muted mono and nothing else.
 * Compacted to one line, it frees the row for the tools — which is the first
 * thing a visitor can actually *do* on the site.
 *
 * These cards carry more colour than the rest of the page on purpose. They are
 * the only interactive utility above the fold, and the two-ink scheme makes
 * everything else deliberately quiet; a flat amber label would have vanished
 * next to the front page. The hues are the validated data inks (see
 * globals.css) rather than new ones, so the section still belongs to the brand.
 */
export async function MissionStrip({ mission }: { mission: string }) {
  const [cultivares, operadores] = await Promise.all([getCultivares(), getOperadoresTotal()]);

  const tarjetas = [
    {
      href: "/semillas/leer",
      icono: ScanQrCode,
      color: "var(--data-rnc)",
      titulo: "Leer un rótulo",
      dato: "Escaneá el código",
      datoCorto: "Escanear",
    },
    {
      href: "/semillas/operadores",
      icono: Building2,
      color: "var(--data-rnpc)",
      titulo: "Operadores",
      dato: operadores ? `${operadores.toLocaleString("es-AR")} en el padrón` : "Padrón RNCyFS",
      datoCorto: operadores ? operadores.toLocaleString("es-AR") : "Padrón",
    },
    {
      href: "/semillas",
      icono: Sprout,
      color: "var(--sun)",
      titulo: "Cultivares",
      dato: cultivares.length > 0 ? `${cultivares.length} inscriptos` : "Catálogo Nacional",
      datoCorto: cultivares.length > 0 ? `${cultivares.length}` : "Catálogo",
    },
  ] as const;

  return (
    <div className="section-rule grid gap-x-8 gap-y-5 pt-2.5 pb-3.5 sm:pt-4 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      {/* La misión se oculta en el teléfono. Ahí el pliegue es escaso y tres
          líneas de declaración institucional empujan las consultas —lo único
          accionable— fuera de la pantalla. Sigue en el HTML para lectores de
          pantalla y buscadores; solo deja de ocupar espacio visual. */}
      <p className="label sr-only max-w-md leading-relaxed text-muted-foreground sm:not-sr-only">
        {mission}
      </p>

      <div className="lg:w-[41rem]">
        <MissionStripToggle resumen="Consultas oficiales de INASE">
          {/* Procedencia arriba y no al pie: sin esto las tarjetas parecen datos
            propios de la asociación. Son un espejo de registros del Estado, y
            confundir una cosa con la otra es el modo más fácil de que alguien
            decida mal. El enlace va a la fuente, no a nuestra sección. */}
          {/* En el teléfono va todo en un enlace de una línea: partido en dos
            piezas envolvía y se comía 35 px. De `sm` para arriba reaparece la
            aclaración completa. */}
          <p className="mb-1.5 font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-muted-foreground uppercase sm:mb-2 sm:text-[0.6875rem] sm:tracking-[0.14em]">
            <a
              href={INASE_WEB}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 hover:underline"
            >
              {/* En el teléfono el botón que abre este panel ya dice "Consultas
                  oficiales de INASE": repetirlo acá sobra, así que queda solo
                  el enlace a la fuente. */}
              <span className="text-ember sm:hidden">Ver en el sitio de INASE</span>
              <span className="hidden sm:inline">
                <span className="text-ember">Datos oficiales de INASE</span>{" "}
                <span aria-hidden className="text-rule">
                  ·
                </span>{" "}
                consultados en su sitio
              </span>
              <ArrowUpRight className="size-3 shrink-0" aria-hidden />
            </a>
          </p>

          {/* Tres al ancho SIEMPRE, también en el teléfono. Con ~115 px por
            tarjeta el icono no entra al lado del texto, así que abajo de `sm`
            se apila y se centra; de `sm` para arriba vuelve a la fila con el
            tamaño de siempre. Sin `truncate`: con 34rem los rótulos se cortaban
            en "ESCANEÁ LA ES…", que es peor que no ponerlos. */}
          <ul className="grid grid-cols-3 gap-px bg-rule">
            {tarjetas.map(t => {
              const Icono = t.icono;
              return (
                <li key={t.href} className="bg-background">
                  <Link
                    href={t.href}
                    className="group flex h-full flex-col items-center gap-1 px-1 py-1.5 text-center transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:gap-2.5 sm:px-3 sm:py-2.5 sm:text-left"
                  >
                    {/* El color va en un chip sólido, no en el texto: una etiqueta
                    en ámbar sobre papel no llega al contraste de lectura. */}
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center sm:size-8"
                      style={{ backgroundColor: t.color }}
                    >
                      <Icono className="size-3.5 text-[#00001c] sm:size-4" strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-[0.7rem] leading-tight font-semibold whitespace-nowrap group-hover:text-ember sm:text-sm sm:whitespace-normal">
                        {t.titulo}
                      </span>
                      {/* `.label` vive fuera de un @layer y gana por orden de
                        fuente, así que una utilidad de tamaño no lo pisaría:
                        acá se replican sus propiedades para poder achicarlo. */}
                      <span className="mt-0.5 block font-mono text-[0.5625rem] leading-tight font-medium tracking-[0.1em] whitespace-nowrap text-muted-foreground uppercase sm:text-[0.6875rem] sm:tracking-[0.14em]">
                        <span className="sm:hidden">{t.datoCorto}</span>
                        <span className="hidden sm:inline">{t.dato}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </MissionStripToggle>
      </div>
    </div>
  );
}
