import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowLeft, ArrowUpRight, Info } from "lucide-react";
import { getCultivares, getOperadorByNumero, type Cultivar, type Operador } from "@/lib/semillas";
import { bestMatches, numeroDeInscripcion, parseSerie } from "@/lib/match";
import { localizedAlternates } from "@/lib/seo";
import { ReaderForm } from "./reader-form";
import { Categorias } from "../categorias";

type Params = Promise<{ lang: string }>;
type Search = Promise<{ cultivar?: string; rncyfs?: string; serie?: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return {
    title: "Leer un rótulo",
    description:
      "Consultá el cultivar y el operador de un paquete de semillas contra los registros públicos de INASE.",
    alternates: localizedAlternates(lang, "/semillas/leer"),
  };
}

const INASE_EMPRESAS = "https://gestion.inase.gob.ar/empresas/empresas";

export default async function LeerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { lang } = await params;
  const sp = await searchParams;
  setRequestLocale(lang);
  const t = await getTranslations("seeds");

  const qCultivar = (sp.cultivar ?? "").trim();
  const qRncyfs = (sp.rncyfs ?? "").trim();
  const qSerie = (sp.serie ?? "").trim();
  const consulted = Boolean(qCultivar || qRncyfs || qSerie);

  // Fuzzy-match the cultivar over the mirrored list, because the name is read
  // off a curved label and rarely arrives clean.
  let matches: Array<{ item: Cultivar; distance: number }> = [];
  if (qCultivar) {
    const cultivares = await getCultivares();
    matches = bestMatches(qCultivar, cultivares, c => c.nombre, { limit: 4 });
  }

  const numero = qRncyfs ? numeroDeInscripcion(qRncyfs) : null;
  const operador: Operador | null = numero !== null ? await getOperadorByNumero(numero) : null;

  const serie = qSerie ? parseSerie(qSerie) : null;

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <Link
        href="/semillas"
        className="label mt-6 inline-flex items-center gap-1 text-ember hover:underline"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("volver")}
      </Link>

      <header className="section-rule mt-4 pt-5 pb-8">
        <p className="label text-ember">Consulta</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          Leer un rótulo
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          Copiá del paquete el nombre del cultivar y el número de inscripción, y los buscamos en los
          registros públicos de INASE. Si no sabés dónde están, mirá{" "}
          <Link href="/semillas/rotulo" className="text-ember hover:underline">
            cómo leer un rótulo
          </Link>
          .
        </p>
      </header>

      <ReaderForm initial={{ cultivar: qCultivar, rncyfs: qRncyfs, serie: qSerie }} />

      {consulted ? (
        <div className="mt-12 grid gap-x-12 gap-y-10 lg:grid-cols-2">
          <section>
            <h2 className="section-rule label pt-3 pb-3 text-ink">Cultivar</h2>
            {!qCultivar ? (
              <p className="font-serif text-base text-muted-foreground">
                No ingresaste un cultivar.
              </p>
            ) : matches.length === 0 ? (
              <NotFoundNote
                title="No encontramos ese cultivar en el Catálogo Nacional"
                body="Puede ser que el nombre esté escrito distinto en el registro, que el rótulo tenga un nombre comercial en lugar del cultivar inscripto, o que la variedad no figure. Probá con otra grafía o verificá en la consulta oficial."
                href="https://gestion.inase.gob.ar/registroCultivares/publico/catalogo"
              />
            ) : (
              <ul className="border-t border-rule">
                {matches.map(({ item, distance }) => (
                  <li key={item.numeroRegistro} className="border-b border-rule py-4">
                    <Link href={`/semillas/${item.numeroRegistro}`} className="group block">
                      <h3 className="text-xl font-semibold group-hover:underline">{item.nombre}</h3>
                      <p className="label mt-1.5 text-muted-foreground">
                        {t("registro")} {item.numeroRegistro}
                        {item.especie ? ` · ${item.especie}` : ""}
                      </p>
                      {item.solicitanteRnc ? (
                        <p className="mt-1.5 font-serif text-sm text-muted-foreground">
                          {t("obtentor")}: {item.solicitanteRnc}
                        </p>
                      ) : null}
                      {/* Cuando no fue una coincidencia exacta lo decimos: el
                          usuario tiene que poder descartar una sugerencia. */}
                      {distance > 0 ? (
                        <p className="label mt-1.5 text-ember">Coincidencia aproximada</p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="section-rule label pt-3 pb-3 text-ink">{t("identificador")}</h2>
            {!qRncyfs ? (
              <p className="font-serif text-base text-muted-foreground">
                No ingresaste un número de inscripción.
              </p>
            ) : operador ? (
              <div className="border-t border-rule pt-4">
                <h3 className="text-xl font-semibold">{operador.razonSocial}</h3>
                <p className="label mt-1.5 text-ember">{operador.numeroInscripcion}</p>
                <p className="mt-1.5 font-serif text-base text-muted-foreground">
                  {[operador.localidad, operador.provincia].filter(Boolean).join(", ")}
                </p>
                <p className="mt-2 font-serif text-sm text-muted-foreground">
                  {t("identificadorHelp")}
                </p>
                {operador.categorias?.length ? (
                  <div className="mt-4">
                    <Categorias
                      codigos={operador.categorias}
                      label={t("categorias")}
                      sourceLabel={t("categoriasSource")}
                      help={t("categoriasHelp")}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <NotFoundNote
                title={t("notListed")}
                body={t("notListedHelp")}
                href={INASE_EMPRESAS}
              />
            )}
          </section>
        </div>
      ) : null}

      {serie ? (
        <section className="mt-10 border-y border-rule bg-muted/30 px-5 py-5 sm:px-6">
          <h2 className="label text-ember">Serie de la estampilla</h2>
          <p className="mt-2 font-serif text-lg tabular-nums">
            {serie.valid ? `${serie.prefijo}${serie.serie}` : qSerie}
          </p>
          {/* Este párrafo es el que evita que la herramienta prometa de más.
              Verificado sobre paquetes reales: el DataMatrix contiene sólo esta
              serie y no hay consulta pública donde contrastarla. */}
          <p className="mt-2 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
            Esta serie identifica el paquete, pero{" "}
            <strong className="text-ink">no podemos validarla</strong>: INASE no publica ninguna
            consulta abierta de estampillas. Sirve para anotarla o citarla, no como comprobante. Lo
            que sí se verifica es el cultivar y el número de inscripción.
          </p>
        </section>
      ) : null}
    </main>
  );
}

function NotFoundNote({ title, body, href }: { title: string; body: string; href: string }) {
  return (
    <div className="border-y border-rule bg-muted/30 px-4 py-4">
      <h3 className="label flex items-center gap-2 text-ember">
        <Info className="size-4" aria-hidden />
        {title}
      </h3>
      <p className="mt-2 font-serif text-base leading-relaxed text-muted-foreground">{body}</p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="label mt-3 inline-flex items-center gap-1 text-ember hover:underline"
      >
        Consulta oficial en INASE
        <ArrowUpRight className="size-3.5" aria-hidden />
      </a>
    </div>
  );
}
