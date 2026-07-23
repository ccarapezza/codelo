import { ArrowUpRight, Handshake } from "lucide-react";

const ACUERDO_URL = "https://regulacionlegal.org/";

/**
 * Institutional affiliation: the Acuerdo por la Regulación Legal del Cannabis.
 *
 * Framed as a POLICY position, never as encouragement to consume. The
 * distinction is the association's own hard rule (Art. 2°: nothing here
 * promotes the consumption of any substance), and it is also how the agreement
 * describes itself — reform of drug policy, harm reduction, and not
 * criminalising conduct. Copy taken from regulacionlegal.org/quienes-somos,
 * not paraphrased from memory.
 */
export function AcuerdoRegulacion() {
  return (
    <section aria-label="Acuerdo por la Regulación Legal del Cannabis" className="mt-10">
      <div className="section-rule pt-3">
        <h2 className="label text-ink">Adherimos</h2>
      </div>

      <a href={ACUERDO_URL} target="_blank" rel="noopener noreferrer" className="group mt-3 block">
        <p className="label flex items-center gap-2 text-ember">
          <Handshake className="size-4 shrink-0" aria-hidden strokeWidth={1.75} />
          Acuerdo por la Regulación Legal del Cannabis
        </p>
        <p className="mt-2 font-serif text-sm leading-relaxed text-muted-foreground">
          Organizaciones de derechos humanos, ciencias sociales, educación y salud mental que
          impulsan una reforma de las políticas de drogas centrada en los derechos de las personas.
        </p>
        <span className="label mt-2.5 inline-flex items-center gap-1 text-ember group-hover:underline">
          regulacionlegal.org
          <ArrowUpRight className="size-3.5" aria-hidden />
        </span>
      </a>
    </section>
  );
}
