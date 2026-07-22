import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { CIUDAD_FOOTER } from "@/lib/laminas";
import { SITE_NAME } from "@/lib/site";

export async function SiteFooter() {
  const [t, tHeader, tNav] = await Promise.all([
    getTranslations("footer"),
    getTranslations("header"),
    getTranslations("nav"),
  ]);

  const SECTIONS = [
    {
      label: t("sectionSite"),
      links: [
        { href: "/", label: tNav("home") },
        { href: "/quienes-somos", label: tNav("about") },
        { href: "/contacto", label: tNav("contact") },
      ],
    },
    {
      label: t("sectionInfo"),
      links: [
        { href: "/reprocann", label: tNav("reprocann") },
        { href: "/semillas", label: tNav("seeds") },
        { href: "/clima", label: tNav("weather") },
        { href: "/actividades", label: tNav("events") },
      ],
    },
    {
      label: t("sectionEditorial"),
      links: [{ href: "/blog", label: tNav("blog") }],
    },
  ];

  const year = new Date().getFullYear();

  return (
    /* La mitad oscura del logo. El cuerpo del sitio es papel; el pie es la
       tinta. Mantiene el mismo par de colores en claro y en oscuro a
       propósito: es el remate de marca, no una superficie más de la interfaz. */
    <footer className="footer-ink relative mt-24 overflow-hidden">
      {/* Friso del oeste como FONDO de la banda: horizonte apoyado en el borde
          inferior, detrás del contenido y atenuado — cielo transparente (la
          tinta se ve a través), techos en papel y sol en ámbar; la escena del
          logo extendida a paisaje. Un solo bake porque la banda no sigue al
          tema. width/height en vez de fill: el alto sale del aspect del asset
          y el footer conserva el suyo propio. */}
      {/* En mobile el friso se ensancha más allá del viewport y se ancla a la
          derecha: a ancho completo la ciudad quedaba en una franja de ~50 px y
          el sol —que vive en el extremo derecho— era un punto. El excedente se
          recorta por la izquierda, que es la mitad tranquila del dibujo. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-end">
        <Image
          src={CIUDAD_FOOTER.ink}
          alt=""
          width={1472}
          height={199}
          sizes="(min-width: 640px) 100vw, 220vw"
          className="h-auto w-[220%] max-w-none opacity-45 sm:w-full"
        />
      </div>
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
                src="/icons/logo.png"
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

        <div className="label mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-current/25 pt-6 opacity-70">
          <p>{t("copyright", { year })}</p>
          <p>{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
