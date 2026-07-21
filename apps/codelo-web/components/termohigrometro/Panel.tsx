import { MapPin } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { SITE_NAME } from "@/lib/site";
import { formatNumber } from "@/lib/intl";
import { evaluarAviso } from "@/lib/weather";
import { Aviso } from "./Aviso";
import { dseg } from "./dseg";
import { RelojSegmentos } from "./RelojSegmentos";
import { SegLectura } from "./SieteSegmentos";
import type { PanelProps } from "./tipos";
import { UbicacionControl } from "./UbicacionControl";
import { WmoIcono } from "./WmoIcono";

/**
 * Termohigrómetro digital: bisel en tinta, vidrio tintado ámbar, cifras en
 * siete segmentos. La forma del aparato, en las tintas del sitio.
 *
 * El chrome (bisel, vidrio, rótulos, filetes) vive en globals.css porque usa
 * las constantes de marca `--brand-*`, que NO se invierten con el tema: el
 * vidrio es una pieza impresa, no una superficie de interfaz — mismo criterio
 * que `.boletin-panel`, el pie y el duotono.
 */
export async function Panel({ lectura, lugar, horaServidor, locale }: PanelProps) {
  const t = await getTranslations("home");

  const sinLectura = t("wx.sinLectura");

  return (
    // `dseg.variable` define --font-dseg acá: no hace falta cargar la fuente en
    // el layout global, que es de toda la web y no debería saber de esto.
    <section aria-labelledby="termo" className={dseg.variable}>
      <div className="mb-3 flex items-start justify-between gap-3">
        {/* Mismo esquema que el panel del Boletín —titular en egipcia con su
            bajada en la segunda tinta— pero a menor escala: los dos viven en el
            mismo riel y el Boletín tiene que seguir mandando. */}
        <div className="min-w-0">
          <h2 id="termo" className="font-display text-2xl leading-none font-semibold text-balance">
            {t("wx.titulo")}
          </h2>
          <p className="label mt-1.5 text-ember">{t("wx.subtitulo")}</p>
        </div>

        {/* La salvedad de lectura, detrás de un `?`. Va en <details> y no en un
            tooltip a propósito: un tooltip no existe en touch, y esto es
            justamente lo que alguien va a querer consultar desde el teléfono.
            Sin JS y accesible por teclado de fábrica. */}
        <details className="termo-ayuda">
          <summary aria-label={t("wx.ayudaLabel")}>?</summary>
          <p className="font-serif text-[0.75rem] leading-snug text-muted-foreground">
            {t("wx.avisoNota")}
          </p>
        </details>
      </div>

      {/* EL APARATO. Adentro del bisel va lo que tendría uno real: el cristal,
          la serigrafía y el control de ubicación, que es un botón del aparato.
          La prosa —el aviso— vive afuera, sobre el papel: un párrafo dentro del
          objeto rompía la ilusión de que es un objeto. */}
      <div className="termo-bisel">
        <div className="termo-vidrio px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          {/* El lugar sube acá: abajo, el rótulo del icono pasó a describir
              el estado del tiempo. */}
          <p className="termo-rotulo flex min-w-0 items-center gap-1.5">
            <MapPin aria-hidden="true" focusable="false" className="size-3 shrink-0" />
            <span className="truncate">{lugar.label}</span>
          </p>
          <RelojSegmentos
            zona={lectura?.zona ?? "UTC"}
            horaServidor={horaServidor}
            rotulo={t("wx.hora")}
            tamano="micro"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 items-end gap-4">
          <div>
            <SegLectura
              value={lectura ? lectura.temperatura.toFixed(1) : ""}
              ancho={3}
              unidad="°C"
              sr={
                lectura
                  ? `${t("wx.temperatura")}: ${formatNumber(lectura.temperatura, locale)} °C`
                  : sinLectura
              }
            />
            <p className="termo-rotulo mt-1 text-center">{t("wx.temperatura")}</p>
          </div>
          <div>
            <SegLectura
              value={lectura ? String(Math.round(lectura.humedad)) : ""}
              ancho={2}
              legenda="%"
              sr={
                lectura
                  ? `${t("wx.humedad")}: ${formatNumber(lectura.humedad, locale)} %`
                  : sinLectura
              }
            />
            <p className="termo-rotulo mt-1 text-center">{t("wx.humedad")}</p>
          </div>
        </div>

        <div className="termo-filete mt-1.5 grid grid-cols-2 items-end gap-4 pt-2">
          <div>
            <div className="termo-icono-grande">
              {lectura ? <WmoIcono grupo={lectura.grupo} esDeDia={lectura.esDeDia} /> : null}
            </div>
            <p className="termo-rotulo mt-1 truncate text-center">
              {lectura ? t(`wx.estado.${lectura.grupo}`) : ""}
            </p>
          </div>
          <div>
            <SegLectura
              value={lectura ? lectura.vpd.toFixed(2) : ""}
              ancho={3}
              sr={lectura ? `${t("wx.vpd")}: ${formatNumber(lectura.vpd, locale)} kPa` : sinLectura}
              tamano="chico"
            />
            <p className="termo-rotulo mt-1 text-center">kPa · {t("wx.vpd")}</p>
          </div>
        </div>
        </div>

        {/* Serigrafía del aparato: sello moldeado, marca y el botón de
            ubicación, como los controles del frente de un aparato real. */}
        <div className="termo-marca">
          <span className="termo-sello" aria-hidden="true">
            <span className="termo-sello-forma" />
          </span>
          <span className="hidden truncate sm:inline">{SITE_NAME}</span>
          <span className="termo-marca-accion">
            <UbicacionControl esDefault={lugar.isDefault} />
          </span>
        </div>
      </div>

      {/* FUERA DEL APARATO, sobre papel. */}
      <div className="mt-4">
        {lectura ? (
          <Aviso {...evaluarAviso(lectura)} />
        ) : (
          <p role="status" className="font-serif text-[0.8125rem] leading-snug text-muted-foreground">
            {t("wx.sinLecturaExplain")}
          </p>
        )}
      </div>
    </section>
  );
}
