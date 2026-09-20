import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowUpRight, SatelliteDish } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Tabla } from "@/components/charts/primitivos";
import { AvisoPronostico } from "@/components/termohigrometro/AvisoPronostico";
import { resolverLugar } from "@/components/termohigrometro/lugar";
import { WmoIcono } from "@/components/termohigrometro/WmoIcono";
import type { Locale } from "@/i18n/routing";
import { formatShortDate, formatWeekday, localeTimeZone } from "@/lib/intl";
import { pageMetadata } from "@/lib/seo";
import {
  balanceHidrico,
  bandaDli,
  type Dia,
  dliDesdeRadiacion,
  evaluarAvisosPronostico,
  fraccionDeSol,
  getPronostico,
  getWeather,
  type Horario,
  type Lectura,
  type Pronostico,
  recortarDesdeAhora,
  tendenciaFotoperiodo,
} from "@/lib/weather";
import {
  BarraMinMax,
  BarrasHorarias,
  COLOR_AGUA,
  COLOR_CALOR,
  COLOR_VEGETAL,
  LineaHoraria,
  Medidor,
} from "./charts";
import { ArcoSolar, Instrumento, Panel, RosaViento } from "./instrumentos";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "clima" });
  return pageMetadata({ lang, path: "/clima", title: t("title"), description: t("tagline") });
}

const n1 = (v: number) => v.toFixed(1);
const n0 = (v: number) => String(Math.round(v));

/*
 * Las fechas del bloque diario son fechas de CALENDARIO ("2026-07-22"), sin
 * hora. `new Date()` las interpreta como medianoche UTC, así que formatearlas
 * en una zona al oeste de Greenwich las retrocede un día: en Buenos Aires
 * (UTC−3) el 22 se mostraba como 21 y la semana arrancaba el día anterior.
 *
 * Ojo: NO aplica a `Horario.hora`, que trae hora local y se corta por índice
 * de string sin pasar por Date.
 */
const diaCorto = (fecha: string, locale: Locale) => formatShortDate(fecha, locale, "UTC");
const diaSemana = (fecha: string, locale: Locale) => formatWeekday(fecha, locale, "UTC");

/** `?` con la salvedad, igual que en el termohigrómetro de la home. */
function Ayuda({ texto, label }: { texto: string; label: string }) {
  return (
    <details className="termo-ayuda shrink-0">
      <summary aria-label={label}>?</summary>
      <p className="font-serif text-[0.75rem] leading-snug text-muted-foreground">{texto}</p>
    </details>
  );
}

/* -------------------------------------------------------------------------- */
/* Fila de instrumentos                                                        */
/* -------------------------------------------------------------------------- */

async function Consola({ lectura }: { lectura: Lectura }) {
  const t = await getTranslations("clima");

  return (
    <section aria-labelledby="ahora">
      <h2 id="ahora" className="section-rule label pt-3 pb-4 text-ink">
        {t("ahora.titulo")}
      </h2>

      {/* Cuadrícula de aparatos. `auto-fit` en vez de un número fijo de
          columnas: los instrumentos son de ancho parejo, así que se acomodan
          solos de 2 en mobile a 6 en escritorio sin un breakpoint por tramo. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Instrumento
          rotulo={t("horas.temperatura")}
          valor={n1(lectura.temperatura)}
          sr={`${lectura.temperatura} grados`}
          ancho={3}
          unidad="°C"
          familia="calor"
          pie={lectura.sensacion !== null ? `${t("ahora.sensacion")} ${n0(lectura.sensacion)}°` : undefined}
        />
        <Instrumento
          rotulo={t("horas.rocio")}
          valor={lectura.rocio === null ? "--" : n1(lectura.rocio)}
          sr={`Punto de rocío ${lectura.rocio ?? "sin dato"}`}
          ancho={3}
          unidad="°C"
          familia="agua"
          pie={`${t("ahora.rocio")}`}
        />
        <Instrumento
          rotulo={t("ahora.humedad")}
          valor={n0(lectura.humedad)}
          sr={`Humedad ${lectura.humedad} por ciento`}
          ancho={3}
          legenda="%"
          familia="agua"
          pie={t("ahora.nubosidad") + (lectura.nubosidad !== null ? ` ${n0(lectura.nubosidad)}%` : "")}
        />
        <Instrumento
          rotulo="DPV"
          valor={n1(lectura.vpd)}
          sr={`Déficit de presión de vapor ${lectura.vpd} kilopascales`}
          ancho={3}
          legenda="kPa"
          familia="calor"
          pie="kPa"
        />
        <Instrumento
          rotulo={t("ahora.uv")}
          valor={lectura.uv === null ? "--" : n1(lectura.uv)}
          sr={`Índice UV ${lectura.uv ?? "sin dato"}`}
          ancho={3}
          familia="uv"
          pie={t("ahora.uv")}
        />
        <Instrumento
          rotulo={t("ahora.viento")}
          valor={lectura.viento === null ? "--" : n0(lectura.viento)}
          sr={`Viento ${lectura.viento ?? "sin dato"} kilómetros por hora`}
          ancho={3}
          legenda="km/h"
          familia="viento"
          pie={lectura.rafaga !== null ? `${t("ahora.rafagaCorta")} ${n0(lectura.rafaga)}` : "km/h"}
        />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

async function TableroPronostico({
  lectura,
  horas,
  dias,
  locale,
}: {
  lectura: Lectura | null;
  horas: Horario[];
  dias: Dia[];
  locale: Locale;
}) {
  const t = await getTranslations("clima");
  const hoy = dias[0];
  const tendencia = tendenciaFotoperiodo(dias);
  const dli = hoy?.radiacionMJ == null ? null : dliDesdeRadiacion(hoy.radiacionMJ);
  const sol = hoy ? fraccionDeSol(hoy) : null;
  const hhmm = (h: number) => `${Math.floor(h)} h ${Math.round((h % 1) * 60)} min`;

  const minSem = dias.length ? Math.min(...dias.map(d => d.minima)) : 0;
  const maxSem = dias.length ? Math.max(...dias.map(d => d.maxima)) : 1;

  const ritmo =
    tendencia === null
      ? null
      : tendencia.sentido === "estable"
        ? t("luz.ritmoEstable")
        : t(tendencia.sentido === "acorta" ? "luz.ritmoAcorta" : "luz.ritmoAlarga", {
            minutos: `${Math.abs(tendencia.minutosPorDia).toFixed(1)} min`,
          });

  return (
    // Cuadrícula de 6 columnas: cada panel declara cuántas ocupa, así conviven
    // paneles anchos (series de 48 h) y angostos (el día, el viento) sin que
    // la página sea una sola columna apilada.
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-6">
      {horas.length > 1 ? (
        <Panel
          titulo={t("horas.temperatura")}
          bajada={t("horas.bajadaTemp")}
          className="md:col-span-4"
        >
          <LineaHoraria
            horas={horas}
            unidad="°C"
            etiquetaNoche={t("horas.noche")}
            series={[
              { valores: horas.map(h => h.temperatura), color: COLOR_CALOR, nombre: t("horas.temperatura") },
              ...(horas.some(h => h.rocio !== null)
                ? [{ valores: horas.map(h => h.rocio), color: COLOR_AGUA, nombre: t("horas.rocio") }]
                : []),
            ]}
          />
          <ul className="label mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {[
              { color: COLOR_CALOR, nombre: t("horas.temperatura") },
              { color: COLOR_AGUA, nombre: t("horas.rocio") },
            ].map(s => (
              <li key={s.nombre} className="flex items-center gap-2">
                <span aria-hidden className="inline-block size-2.5 shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-muted-foreground">{s.nombre}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* El día: arco solar + fotoperiodo. La infografía más alusiva de la
          página, porque muestra amanecer, atardecer y momento actual juntos. */}
      {hoy?.amanece && hoy?.atardece ? (
        <Panel
          titulo={t("luz.tituloPanel")}
          className="md:col-span-2"
          ayuda={<Ayuda texto={t("luz.fotoperiodoExplain")} label={t("luz.duracion")} />}
        >
          <ArcoSolar
            amanece={hoy.amanece}
            atardece={hoy.atardece}
            ahora={lectura?.observadoEn ?? null}
            etiquetaAmanece={t("luz.amanece")}
            etiquetaAtardece={t("luz.atardece")}
          />
          <p className="mt-3 font-display text-3xl leading-none font-semibold tabular-nums">
            {hoy.luzHoras === null ? "—" : hhmm(hoy.luzHoras)}
          </p>
          <p className="label mt-1 text-muted-foreground">{t("luz.duracion")}</p>
          {ritmo ? (
            <p className="mt-2 font-serif text-sm leading-snug text-muted-foreground">{ritmo}</p>
          ) : null}
        </Panel>
      ) : null}

      {horas.some(h => h.vpd !== null) ? (
        <Panel titulo={t("horas.vpd")} bajada={t("horas.bajadaVpd")} className="md:col-span-3">
          <LineaHoraria
            horas={horas}
            unidad="kPa"
            etiquetaNoche={t("horas.noche")}
            formato={v => v.toFixed(2)}
            series={[{ valores: horas.map(h => h.vpd), color: COLOR_CALOR, nombre: t("horas.vpd") }]}
          />
        </Panel>
      ) : null}

      {horas.some(h => h.probLluvia !== null) ? (
        <Panel titulo={t("horas.probLluvia")} bajada={t("horas.bajadaLluvia")} className="md:col-span-3">
          <BarrasHorarias
            horas={horas}
            valores={horas.map(h => h.probLluvia)}
            etiqueta={t("horas.probLluvia")}
          />
        </Panel>
      ) : null}

      {dias.length > 0 ? (
        <Panel titulo={t("dias.tituloPanel")} bajada={t("dias.bajada")} className="md:col-span-4">
          <ul>
            {dias.map(d => (
              <li
                key={d.fecha}
                className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-x-3 border-b border-rule py-2.5 last:border-b-0"
              >
                <span className="label w-16 text-ink">{diaSemana(d.fecha, locale)}</span>
                <WmoIcono grupo={d.grupo} esDeDia className="size-5 text-ember" />
                <div className="flex items-center gap-2.5">
                  <span className="label w-7 shrink-0 text-right tabular-nums text-muted-foreground">
                    {n0(d.minima)}°
                  </span>
                  <BarraMinMax
                    dia={d}
                    min={minSem}
                    max={maxSem}
                    etiquetaMin={t("dias.minima")}
                    etiquetaMax={t("dias.maxima")}
                  />
                  <span className="label w-7 shrink-0 tabular-nums text-foreground">
                    {n0(d.maxima)}°
                  </span>
                </div>
                <span className="label w-14 text-right tabular-nums text-muted-foreground">
                  {d.lluviaMm !== null && d.lluviaMm > 0 ? `${n1(d.lluviaMm)}mm` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {/* Luz acumulada: medidor con bandas, no un número suelto. */}
      {dli !== null ? (
        <Panel
          titulo={t("luz.dli")}
          className="md:col-span-2"
          ayuda={<Ayuda texto={t("luz.dliExplain")} label={t("luz.dli")} />}
        >
          <p className="font-display text-4xl leading-none font-semibold tabular-nums">
            {n1(dli)}
            <span className="ml-2 font-mono text-[0.28em] tracking-widest uppercase">
              {t("luz.dliUnidad")}
            </span>
          </p>
          <p className="mt-2 font-serif text-sm text-muted-foreground">
            {t(`luz.banda.${bandaDli(dli)}`)}
          </p>
          <div className="mt-4">
            <Medidor valor={dli} max={65} umbrales={[10, 20, 35]} etiqueta={t("luz.dli")} />
          </div>
          {sol !== null && hoy?.solHoras != null ? (
            <p className="label mt-3 text-muted-foreground">
              {t("luz.sol")} {hhmm(hoy.solHoras)} ({Math.round(sol * 100)} %)
            </p>
          ) : null}
        </Panel>
      ) : null}

      {/* Viento: rosa con aguja. */}
      {lectura?.vientoDir != null && lectura.viento !== null ? (
        <Panel titulo={t("rosas.titulo")} className="md:col-span-2">
          <RosaViento
            grados={lectura.vientoDir}
            velocidad={lectura.viento}
            rafaga={lectura.rafaga}
            etiquetaRafaga={t("ahora.rafaga")}
          />
        </Panel>
      ) : null}

      {horas.some(h => h.sueloTemp !== null) ? (
        <Panel titulo={t("suelo.tituloTemp")} className="md:col-span-4">
          <LineaHoraria
            horas={horas}
            unidad="°C"
            etiquetaNoche={t("horas.noche")}
            series={[
              { valores: horas.map(h => h.sueloTemp), color: COLOR_VEGETAL, nombre: t("suelo.temp") },
            ]}
          />
        </Panel>
      ) : null}

      {horas.some(h => h.sueloHumedad !== null) ? (
        <Panel
          titulo={t("suelo.humedad")}
          className="md:col-span-3"
          ayuda={<Ayuda texto={t("suelo.humedadExplain")} label={t("suelo.humedad")} />}
        >
          <LineaHoraria
            horas={horas}
            unidad={t("suelo.humedadUnidad")}
            etiquetaNoche={t("horas.noche")}
            formato={v => v.toFixed(3)}
            series={[
              { valores: horas.map(h => h.sueloHumedad), color: COLOR_AGUA, nombre: t("suelo.humedad") },
            ]}
          />
        </Panel>
      ) : null}

      {dias.some(d => d.et0 !== null) ? (
        <Panel
          titulo={t("suelo.balance")}
          className="md:col-span-3"
          ayuda={<Ayuda texto={t("suelo.balanceExplain")} label={t("suelo.balance")} />}
        >
          <ul>
            {dias.map(d => {
              const b = balanceHidrico(d.et0, d.lluviaMm);
              return (
                <li
                  key={d.fecha}
                  className="flex items-center justify-between gap-3 border-b border-rule py-2 last:border-b-0"
                >
                  <span className="label text-ink">{diaSemana(d.fecha, locale)}</span>
                  <span className="font-serif text-sm tabular-nums text-muted-foreground">
                    {b === null ? "—" : `${b > 0 ? "+" : ""}${n1(b)} mm`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}

      {dias.length > 0 ? (
        <Panel
          titulo={t("luz.tablaTitulo")}
          bajada={t("luz.tablaBajada")}
          className="md:col-span-6"
        >
          <Tabla
            nowrap
            head={[t("dias.dia"), t("luz.duracion"), t("luz.dli")]}
            rows={dias.map(d => [
              diaCorto(d.fecha, locale),
              d.luzHoras === null ? "s/d" : hhmm(d.luzHoras),
              d.radiacionMJ === null ? "s/d" : n1(dliDesdeRadiacion(d.radiacionMJ)),
            ])}
          />
        </Panel>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

async function Riesgos({ pronostico, locale }: { pronostico: Pronostico; locale: Locale }) {
  const t = await getTranslations("clima");
  const avisos = evaluarAvisosPronostico(pronostico);

  return (
    <section aria-labelledby="riesgos" className="mt-12">
      <h2 id="riesgos" className="section-rule label pt-3 pb-4 text-ink">
        {t("riesgos.titulo")}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        {avisos.map(a => (
          <AvisoPronostico
            key={a.clave}
            aviso={a}
            cuandoLegible={a.cuando ? diaSemana(a.cuando, locale) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

async function Contenido({ locale }: { locale: Locale }) {
  const t = await getTranslations("clima");
  const lugar = await resolverLugar();
  const zona = localeTimeZone(locale);

  // En paralelo: dos fetches con TTL distinto cuestan max(), no la suma, y
  // degradan por separado. El `extendido` solo lo pide esta página.
  const [lectura, pronostico] = await Promise.all([
    getWeather(lugar, zona, { extendido: true }),
    getPronostico(lugar),
  ]);

  const horas = pronostico ? recortarDesdeAhora(pronostico.horas, lectura?.observadoEn ?? null) : [];
  const dias = pronostico?.dias ?? [];

  return (
    <>
      <header className="section-rule flex flex-wrap items-end justify-between gap-4 pt-5 pb-8">
        <div>
          <p className="label text-ember">{t("eyebrow")}</p>
          <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
            {t("tagline")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lectura ? (
            <WmoIcono grupo={lectura.grupo} esDeDia={lectura.esDeDia} className="size-7 text-ember" />
          ) : null}
          <p className="label text-muted-foreground">{lugar.label}</p>
        </div>
      </header>

      {lectura ? <Consola lectura={lectura} /> : null}

      {pronostico ? (
        <>
          <Riesgos pronostico={{ horas, dias }} locale={locale} />
          <TableroPronostico lectura={lectura} horas={horas} dias={dias} locale={locale} />
        </>
      ) : (
        <section className="section-rule mt-14 pt-6">
          <p className="font-serif text-muted-foreground">{t("sinPronostico")}</p>
          <p className="mt-2 font-serif text-sm text-muted-foreground">{t("sinPronosticoNota")}</p>
        </section>
      )}

      {/* ---- Procedencia --------------------------------------------------
          Va al pie y no arriba, igual que en /semillas: es la nota de una
          fuente, no una advertencia que deba interrumpir la lectura. Pero va
          sí o sí, y por dos razones distintas:

          1. Licencia. Open-Meteo publica bajo CC BY 4.0 y pide el crédito
             "Weather data by Open-Meteo.com" con enlace junto a CADA lugar
             donde se muestran sus datos. No es cortesía: es la condición de
             uso, y hasta acá el sitio no la cumplía.
          2. Honestidad del dato. El aparato parece un sensor y no lo es. Sin
             decir que el valor sale de un modelo interpolado a ~1,1 km,
             alguien puede creer que mide su patio. */}
      {/* Se dibuja como la PLACA DE ESPECIFICACIONES de un aparato —la chapita
          remachada que traen atrás con la marca, el modelo y la norma—, que es
          exactamente el rol que cumple. Sin logo de Open-Meteo: no publican
          guía de marca ni assets para atribución, y usar la marca de un tercero
          sin sus lineamientos es peor que no usarla. El crédito textual es lo
          que la licencia pide. */}
      <section className="placa mt-16 px-6 py-6 sm:px-8">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-muted text-ember ring-1 ring-rule"
          >
            <SatelliteDish className="size-4.5" strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="label text-muted-foreground">{t("fuente.placa")}</p>
            <h2 className="mt-1 font-display text-xl leading-tight font-semibold">
              {t("fuente.titulo")}
            </h2>
            <p className="mt-3 max-w-3xl font-serif text-base leading-relaxed text-muted-foreground">
              {t("fuente.texto")}
            </p>
            <p className="mt-2 max-w-3xl font-serif text-sm leading-relaxed text-muted-foreground">
              {t("fuente.ubicacion")}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-rule pt-3">
              <a
                href="https://open-meteo.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex items-center gap-1 text-ember hover:underline"
              >
                {t("fuente.enlace")}
                <ArrowUpRight className="size-3.5" aria-hidden />
              </a>
              <span className="label text-muted-foreground">{t("fuente.licencia")}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Esqueleto() {
  return (
    <div className="mt-10 animate-pulse space-y-4" aria-hidden>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded bg-muted" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-6">
        <div className="h-56 rounded bg-muted md:col-span-4" />
        <div className="h-56 rounded bg-muted md:col-span-2" />
      </div>
    </div>
  );
}

export default async function ClimaPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);

  return (
    <main className="mx-auto w-full max-w-[1200px] px-5 pb-24 sm:px-8">
      <Suspense fallback={<Esqueleto />}>
        <Contenido locale={lang as Locale} />
      </Suspense>
    </main>
  );
}
