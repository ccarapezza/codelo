import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { SITE_NAME } from "@/lib/site";
import { MobileNav, type NavItem } from "./MobileNav";
import { ThemeToggle } from "./ThemeToggle";

export async function SiteHeader() {
  const [tNav, tHeader] = await Promise.all([getTranslations("nav"), getTranslations("header")]);
  const NAV: NavItem[] = [
    { href: "/", label: tNav("home") },
    { href: "/quienes-somos", label: tNav("about") },
    { href: "/reprocann", label: tNav("reprocann") },
    { href: "/semillas", label: tNav("seeds") },
    { href: "/actividades", label: tNav("events") },
    { href: "/blog", label: tNav("blog") },
    { href: "/contacto", label: tNav("contact") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/30 bg-background/55 backdrop-blur-md supports-[backdrop-filter]:bg-background/45">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-6 sm:h-16">
        {/* Marca: el sello del logo + el nombre. El sello es la única forma
            circular de todo el sitio, así que funciona como ancla de identidad
            contra una maqueta hecha de filetes y ángulos rectos. */}
        <Link
          href="/"
          aria-label={tHeader("logoAlt")}
          className="flex shrink-0 items-center font-wordmark text-2xl font-extrabold tracking-tight uppercase"
        >
          <Image
            src="/icons/logo.png"
            alt=""
            width={36}
            height={36}
            className="mr-2.5 h-9 w-9"
            priority
          />
          {SITE_NAME}
        </Link>

        {/* `lg` y no `md`: con siete ítems más el conmutador de tema el nav
            no entra a 768 px y empujaba el ancho del documento. Entre md y lg
            manda el menú hamburguesa. */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted hover:text-primary"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>

        {/* Mobile: hamburger drawer with the same nav items + theme toggle. */}
        <MobileNav items={NAV} />
      </div>
    </header>
  );
}
