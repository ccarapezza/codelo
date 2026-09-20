import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight, ArrowLeft } from "lucide-react";
import { getCultivar, searchOperadores, type Operador } from "@/lib/semillas";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbSchema, pageMetadata, SITE_NAME, SITE_URL } from "@/lib/seo";

type Params = Promise<{ lang: string; registro: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, registro } = await params;
  const cultivar = await getCultivar(Number(registro));
  if (!cultivar) return {};
  const t = await getTranslations({ locale: lang, namespace: "seeds" });
  return pageMetadata({
    lang,
    path: `/semillas/${cultivar.numeroRegistro}`,
    title: `${cultivar.nombre} — ${t("title")}`,
    description: `${t("registro")} ${cultivar.numeroRegistro}${
      cultivar.solicitanteRnc ? ` · ${t("obtentor")}: ${cultivar.solicitanteRnc}` : ""
    }`,
  });
}

const INASE_CATALOGO = "https://gestion.inase.gob.ar/registroCultivares/publico/catalogo";

function Field({
  label,
  value,
  help,
}: {
  label: string;
  value: string | null | undefined;
  help?: string;
}) {
  if (!value) return null;
  return (
    <div className="border-b border-rule py-4">
      <dt className="label text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif text-lg leading-snug">{value}</dd>
      {help ? <p className="mt-1 font-serif text-sm text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export default async function CultivarPage({ params }: { params: Params }) {
  const { lang, registro } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("seeds");

  const numero = Number(registro);
  if (!Number.isInteger(numero)) notFound();

  const cultivar = await getCultivar(numero);
  if (!cultivar) notFound();

  // Cruce contra el padrón: si el obtentor está inscripto como operador,
  // enlazamos su ficha. Es una coincidencia por nombre, no un vínculo que INASE
  // publique, así que sólo se muestra cuando hay UNA coincidencia exacta —
  // con dos o más no hay forma de saber cuál es, y elegir sería inventar.
  const candidatos = cultivar.solicitanteRnc
    ? await searchOperadores(cultivar.solicitanteRnc, 5)
    : [];
  const operador = exactMatch(candidatos, cultivar.solicitanteRnc);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <JsonLd
        data={breadcrumbSchema([
          { name: SITE_NAME, url: `${SITE_URL}/${lang}` },
          { name: t("title"), url: `${SITE_URL}/${lang}/semillas` },
          {
            name: cultivar.nombre,
            url: `${SITE_URL}/${lang}/semillas/${cultivar.numeroRegistro}`,
          },
        ])}
      />
      <Link
        href="/semillas"
        className="label mt-6 inline-flex items-center gap-1 text-ember hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("volver")}
      </Link>

      <header className="section-rule mt-4 pt-5 pb-8">
        <p className="label text-ember">
          {t("registro")} {cultivar.numeroRegistro}
        </p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.02] font-semibold tracking-tight text-balance">
          {cultivar.nombre}
        </h1>
        {cultivar.nombreCientifico ? (
          <p className="mt-2 font-serif text-lg italic text-muted-foreground">
            {cultivar.nombreCientifico}
          </p>
        ) : null}
      </header>

      <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
        <section>
          <h2 className="section-rule label pt-3 pb-1 text-ink">{t("cultivar")}</h2>
          <dl>
            <Field label={t("especie")} value={cultivar.especie} />
            <Field label={t("pais")} value={cultivar.codPais} />
            <Field
              label={t("altaRnc")}
              value={formatDate(cultivar.inscripcionRnc) ?? t("sinRnc")}
              help={t("rncHelp")}
            />
            <Field
              label={t("altaRnpc")}
              value={formatDate(cultivar.inscripcionRnpc) ?? t("sinRnpc")}
              help={t("rnpcHelp")}
            />
            <Field label={t("validezRnpc")} value={formatDate(cultivar.validezRnpc)} />
          </dl>
        </section>

        <section>
          <h2 className="section-rule label pt-3 pb-1 text-ink">{t("obtentor")}</h2>
          <dl>
            <Field label={t("obtentor")} value={cultivar.solicitanteRnc} help={t("obtentorHelp")} />
            <Field label={t("representante")} value={cultivar.representanteRnc} />
            {cultivar.solicitanteRnpc && cultivar.solicitanteRnpc !== cultivar.solicitanteRnc ? (
              <Field label={`${t("obtentor")} (RNPC)`} value={cultivar.solicitanteRnpc} />
            ) : null}
          </dl>

          {operador ? (
            <Link
              href={`/semillas/operadores?q=${encodeURIComponent(operador.numeroInscripcion)}`}
              className="label mt-4 inline-flex items-center gap-1 text-ember hover:underline"
            >
              {t("verOperador")}: {operador.numeroInscripcion}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </section>
      </div>

      <a
        href={INASE_CATALOGO}
        target="_blank"
        rel="noopener noreferrer"
        className="label mt-10 inline-flex items-center gap-1 text-ember hover:underline"
      >
        {t("officialSource")}
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </main>
  );
}

/**
 * Only link the breeder to a padrón entry when exactly one row matches its name
 * after folding. INASE publishes no key between the two registries, so anything
 * looser would be us asserting an identity the State never asserted.
 */
function exactMatch(candidatos: Operador[], nombre: string | null): Operador | null {
  if (!nombre) return null;
  const target = fold(nombre);
  const hits = candidatos.filter(o => fold(o.razonSocial) === target);
  return hits.length === 1 ? hits[0] : null;
}

function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}
