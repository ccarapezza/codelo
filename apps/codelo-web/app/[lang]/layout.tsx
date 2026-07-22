import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Big_Shoulders, IBM_Plex_Mono, Literata, Zilla_Slab } from "next/font/google";
import Script from "next/script";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { LocaleAlternatesProvider } from "@/components/locale-alternates";
import { NavigationProgress } from "@/components/NavigationProgress";
import { SiteFooter } from "@/components/SiteFooter";
import { resolveGaId, resolveClarityId } from "@/lib/analytics";
import { getSiteSettings } from "@/lib/cms";
import { JsonLd } from "@/components/JsonLd";
import { OG_LOCALE, organizationSchema, robotsForLocale, websiteSchema } from "@/lib/seo";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

export function generateStaticParams() {
  return routing.locales.map(lang => ({ lang }));
}

// Dirección "Dos Tintas". Tres roles bien separados:
//  · marca    → Big Shoulders: condensada industrial. Se usa SOLO en el
//               nombre de la asociación (cabecera y pie). Toda la audacia
//               tipográfica se gasta ahí y el resto queda disciplinado.
//  · display  → Zilla Slab: egipcia, del mundo de la imprenta, para titulares.
//               Elegida sobre un serif de alto contraste a propósito: ese es
//               uno de los tres "looks por defecto" del diseño generado por IA.
//  · lectura  → Literata: diseñada para leer largo en pantalla.
//  · etiqueta → IBM Plex Mono: metadata, secciones y fechas. El mono da el
//               registro de ficha/laboratorio que pide el temario (etnobotánica,
//               relevamiento normativo) y separa el dato del relato.
const bigShoulders = Big_Shoulders({
  variable: "--font-wordmark",
  subsets: ["latin"],
  display: "swap",
});

const zillaSlab = Zilla_Slab({
  variable: "--font-display",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
});

const literata = Literata({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const [settings, t] = await Promise.all([
    getSiteSettings(),
    getTranslations({ locale: lang, namespace: "site" }),
  ]);
  const title = t("title");
  const description = t("description");
  const gscToken = settings.googleSiteVerification?.trim() || undefined;

  return {
    metadataBase: new URL(SITE_URL),
    verification: gscToken ? { google: gscToken } : undefined,
    // Locale-wide noindex default for non-indexable locales (currently EN —
    // see NOINDEX_LOCALES). Inherited by every page that doesn't set its own
    // `robots`; pages that do must fall back to robotsForLocale(lang) first.
    robots: robotsForLocale(lang),
    title: {
      default: title,
      template: `%s · ${SITE_NAME}`,
    },
    description,
    openGraph: {
      type: "website",
      locale: OG_LOCALE[lang] ?? OG_LOCALE.es,
      siteName: SITE_NAME,
      url: `/${lang}`,
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

const THEME_SCRIPT = `(function(){try{var m=document.cookie.split('; ').find(function(r){return r.indexOf('theme=')===0;});var t=m?m.split('=')[1]:'system';if(t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}}catch(e){}})();`;

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  const { lang } = await params;
  if (!hasLocale(routing.locales, lang)) {
    notFound();
  }
  setRequestLocale(lang);

  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value;
  const htmlClass = theme === "dark" ? "dark" : undefined;

  const settings = await getSiteSettings();
  const gaId = process.env.NODE_ENV === "production" ? resolveGaId(settings) : null;
  const clarityId = process.env.NODE_ENV === "production" ? resolveClarityId(settings) : null;

  return (
    <html lang={lang} translate="no" className={htmlClass} suppressHydrationWarning>
      <body
        className={`${bigShoulders.variable} ${zillaSlab.variable} ${literata.variable} ${plexMono.variable} min-h-screen overflow-x-hidden bg-background font-sans text-foreground antialiased`}
      >
        <Script id="codelo-theme-init" strategy="beforeInteractive">
          {THEME_SCRIPT}
        </Script>
        {/* Identidad del sitio para el Knowledge Graph: quién publica y qué
            sitio es. Los esquemas por contenido (BlogPosting, Event) los
            renderiza cada página. */}
        <JsonLd data={[organizationSchema(), websiteSchema(lang)]} />
        {gaId ? (
          <>
            <Script
              id="ga-loader"
              async
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '${gaId}');`}
            </Script>
          </>
        ) : null}
        {clarityId ? (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${clarityId}");`}
          </Script>
        ) : null}
        <NextIntlClientProvider>
          <LocaleAlternatesProvider>
            <NavigationProgress />
            <SiteHeader />
            {children}
            <SiteFooter />
          </LocaleAlternatesProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
