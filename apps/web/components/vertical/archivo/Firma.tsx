import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { conPreposicion, type NotaArchivo } from "@/lib/vertical/archivo";
import { cn } from "@/lib/utils";

/**
 * La firma de una nota del archivo. En una entrevista que nombra a quién se
 * entrevistó: entrevistador → entrevistado, tal como lo dicen el título o la
 * bajada (la flecha es visual; el lector de pantalla oye la frase entera). Si
 * no, «Por …».
 */
export async function Firma({ nota, className }: { nota: NotaArchivo; className?: string }) {
  const t = await getTranslations("archivo");
  const clase = cn("label text-muted-foreground", className);
  if (nota.tipo !== "entrevista" || !nota.entrevistado) {
    return <p className={clase}>{t("por", { autor: nota.autor })}</p>;
  }
  return (
    <p className={clase}>
      <span className="sr-only">
        {t("entrevistaA", { aQuien: conPreposicion(nota.entrevistado), autor: nota.autor })}
      </span>
      <span aria-hidden className="inline-flex flex-wrap items-center gap-x-1.5">
        <span>{nota.autor}</span>
        <ArrowRight className="size-3.5 shrink-0 text-(--ember-texto)" strokeWidth={1.75} />
        <span className="text-foreground">{nota.entrevistado}</span>
      </span>
    </p>
  );
}
