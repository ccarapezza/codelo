import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { ANIOS, type Anio } from "@/lib/vertical/copa-cata";
import { cn } from "@/lib/utils";

export type SeccionCopa = "inicio" | "palmares" | Anio;

/**
 * Índice interno de la Copa: La Copa · 2014 … 2022 · Palmarés.
 *
 * El header del sitio es plano y ya tiene nueve ítems, así que la Copa tiene
 * su propia navegación arriba de cada página. Son píldoras sobre la noche: en
 * el teléfono pasan a una segunda línea en vez de scrollear —son diez y caben
 * en dos—, así se ven todas sin gesto. La página activa lleva `aria-current`
 * y se enciende en ámbar.
 */
export async function CopaNav({ actual, className }: { actual: SeccionCopa; className?: string }) {
  const t = await getTranslations("copa.nav");
  const items: Array<{ href: string; clave: SeccionCopa; texto: string }> = [
    { href: "/copa-cata", clave: "inicio", texto: t("inicio") },
    ...ANIOS.map((anio) => ({ href: `/copa-cata/${anio}`, clave: anio, texto: String(anio) })),
    { href: "/copa-cata/palmares", clave: "palmares", texto: t("palmares") },
  ];
  return (
    <nav aria-label={t("aria")} className={cn("relative z-10", className)}>
      <ol className="flex flex-wrap items-center gap-1 sm:gap-1.5">
        {items.map((item) => {
          const activo = item.clave === actual;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={activo ? "page" : undefined}
                className={cn(
                  "label inline-flex min-h-8 items-center rounded-full border px-2.5 tabular-nums transition-colors sm:min-h-9 sm:px-3",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  activo
                    ? "copa-luz border-sun/60 bg-sun/12 text-sun"
                    : "border-rule text-muted-foreground hover:border-sun/50 hover:text-foreground",
                )}
              >
                {item.texto}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
