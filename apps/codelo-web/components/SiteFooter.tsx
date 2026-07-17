import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
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
    <footer className="mt-24 border-t border-border bg-muted/20">
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[auto_1fr] lg:gap-20">
          <div className="space-y-4">
            <Link
              href="/"
              aria-label={tHeader("logoAlt")}
              className="inline-flex text-2xl font-bold tracking-tight"
            >
              {SITE_NAME}
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {t("tagline")}
            </p>
          </div>

          <nav aria-label={t("ariaNav")} className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map(section => (
              <div key={section.label} className="space-y-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
                  {section.label}
                </h3>
                <ul className="space-y-2">
                  {section.links.map(link => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-foreground transition-colors hover:text-primary"
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

        <div className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground">
          <p>{t("copyright", { year })}</p>
          <p className="tracking-[0.25em] uppercase">{t("disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
