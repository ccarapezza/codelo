import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SITE_NAME, FOOTER_SECTIONS } from "@/lib/site";
import { FooterArt } from "@/components/vertical";

export async function SiteFooter() {
  const [t, tHeader, tNav] = await Promise.all([
    getTranslations("footer"),
    getTranslations("header"),
    getTranslations("nav"),
  ]);

  // Las columnas del pie son configuración del sitio (lib/site.ts); acá sólo se
  // traducen las claves.
  const SECTIONS = FOOTER_SECTIONS.map(section => ({
    label: t(section.labelKey),
    links: section.items.map(item => ({ href: item.href, label: tNav(item.key) })),
  }));

  const year = new Date().getFullYear();

  return (
    /* La mitad oscura del logo. El cuerpo del sitio es papel; el pie es la
       tinta. Mantiene el mismo par de colores en claro y en oscuro a
       propósito: es el remate de marca, no una superficie más de la interfaz. */
    <footer className="footer-ink relative mt-24 overflow-hidden">
      {FooterArt ? <FooterArt /> : null}
      <div className="relative mx-auto w-full max-w-[1400px] px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-20">
          {/* Sello grande: la única forma circular del sitio, a escala de
              cierre. Decorativo aquí — el nombre a su lado ya nombra el enlace. */}
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            {/* El sello va sobre un disco de papel: sin él, la mitad oscura
                del logo se funde con la tinta del pie y se pierde la silueta,
                que es lo que vuelve reconocible a la marca. Leído como una
                calcomanía impresa sobre la banda. */}
            <Link
              href="/"
              aria-label={tHeader("logoAlt")}
              className="shrink-0 rounded-full bg-[var(--brand-paper)] p-1.5 ring-1 ring-[var(--brand-paper)]/40"
              style={{ width: "fit-content" }}
            >
              <Image
                src="/brand/logo.png"
                alt=""
                width={160}
                height={160}
                className="h-28 w-28 sm:h-36 sm:w-36"
              />
            </Link>
            <div className="min-w-0">
              <p className="font-wordmark text-4xl leading-[0.92] font-extrabold tracking-tight uppercase sm:text-5xl">
                {SITE_NAME}
              </p>
              <p className="mt-4 max-w-sm font-serif text-sm leading-relaxed opacity-75">
                {t("tagline")}
              </p>
              <p className="label mt-5 text-sun">cogollosdeloeste.com.ar</p>
            </div>
          </div>

          <nav
            aria-label={t("ariaNav")}
            className="grid gap-8 sm:grid-cols-3 lg:gap-14"
          >
            {SECTIONS.map(section => (
              <div key={section.label}>
                <h3 className="label border-b border-current/25 pb-2 text-sun">
                  {section.label}
                </h3>
                <ul className="mt-3 space-y-2.5">
                  {section.links.map(link => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="font-serif text-[0.95rem] opacity-85 transition-opacity hover:opacity-100 hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Sombra negra bajo el texto: la barra pisa el friso del fondo y sin
            ella el "Powered by" se pierde contra los techos claros. */}
        <div className="label mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-current/25 pt-6 opacity-70 [text-shadow:0_1px_2px_rgba(0,0,0,1),0_2px_6px_rgba(0,0,0,0.9),0_0_12px_rgba(0,0,0,0.8)]">
          <p>{t("copyright", { year })}</p>
          <p>{t("disclaimer")}</p>
          <a
            href="https://westcode.com.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-opacity hover:opacity-100"
          >
            <span>Powered by</span>
            <Image
              src="/logo-westcode.png"
              alt="Westcode"
              width={136}
              height={20}
              className="h-4 w-auto [filter:drop-shadow(0_1px_2px_rgba(0,0,0,1))_drop-shadow(0_2px_6px_rgba(0,0,0,0.9))]"
            />
          </a>
        </div>
      </div>
    </footer>
  );
}
