import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { getEvents, type CmsEvent } from "@/lib/content";
import type { Locale } from "@/i18n/routing";
import { markdownToSafeHtml } from "@/lib/markdown";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "events" });
  return {
    title: t("title"),
    description: t("tagline"),
    alternates: localizedAlternates(lang, "/actividades"),
  };
}

const TZ = "America/Argentina/Buenos_Aires";

/** Taco de calendario: día grande, mes y hora en mono. */
function DateBlock({ iso, locale }: { iso: string; locale: Locale }) {
  const d = new Date(iso);
  const fmt = (opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale, { ...opts, timeZone: TZ }).format(d);
  return (
    <div>
      <p className="text-4xl leading-none font-semibold tracking-tight tabular-nums">
        {fmt({ day: "2-digit" })}
      </p>
      <p className="label mt-1 text-ember">{fmt({ month: "short" }).replace(".", "")}</p>
      <p className="label mt-0.5 text-muted-foreground">{fmt({ hour: "2-digit", minute: "2-digit" })}</p>
    </div>
  );
}

function EventRow({
  event,
  locale,
  past,
  labels,
}: {
  event: CmsEvent;
  locale: Locale;
  past?: boolean;
  labels: { organizedBy: string; officialSite: string };
}) {
  return (
    <li className="border-b border-rule">
      <div
        className={`grid grid-cols-[4rem_minmax(0,1fr)] gap-x-5 py-7 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-8 ${
          past ? "opacity-60" : ""
        }`}
      >
        <DateBlock iso={event.startsAt} locale={locale} />
        <div className="min-w-0">
          <h3 className="text-2xl leading-tight font-semibold text-balance">{event.title}</h3>

          {/* La atribución va primero y en la segunda tinta: es el dato que
              impide que el portal parezca el organizador. La asociación
              agenda estos eventos, no los produce. */}
          <p className="label mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            {event.organizer ? (
              <span className="text-ember">
                {labels.organizedBy}: {event.organizer}
              </span>
            ) : null}
            {event.organizer && event.place ? <span aria-hidden className="text-rule">·</span> : null}
            {event.place ? <span className="text-muted-foreground">{event.place}</span> : null}
          </p>

          {event.description ? (
            <div
              className="prose prose-base mt-3 max-w-2xl prose-p:font-serif prose-p:text-muted-foreground prose-a:text-ember"
              dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(event.description) }}
            />
          ) : null}

          {event.sourceUrl ? (
            <a
              href={event.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="label mt-4 inline-flex items-center gap-1 text-ember hover:underline"
            >
              {labels.officialSite}
              <ArrowUpRight className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default async function ActividadesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const locale = lang as Locale;
  const t = await getTranslations("events");

  const events = await getEvents({ limit: 100 });
  const now = Date.now();
  const upcoming = events
    .filter(e => new Date(e.startsAt).getTime() >= now)
    .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  const past = events
    .filter(e => new Date(e.startsAt).getTime() < now)
    .sort((a, b) => +new Date(b.startsAt) - +new Date(a.startsAt));

  const labels = { organizedBy: t("organizedBy"), officialSite: t("officialSite") };

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-8">
        <p className="label text-ember">{t("eyebrow")}</p>
        <h1 className="mt-3 text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight">
          {t("title")}
        </h1>
        <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
          {t("tagline")}
        </p>
      </header>

      <section className="border-t border-rule">
        <h2 className="section-rule label pt-3 pb-3 text-ink">{t("upcomingTitle")}</h2>
        {upcoming.length === 0 ? (
          <p className="border-b border-rule py-12 font-serif text-muted-foreground">
            {t("emptyUpcoming")}
          </p>
        ) : (
          <ul>
            {upcoming.map(e => (
              <EventRow key={e.slug} event={e} locale={locale} labels={labels} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="mt-16">
          <h2 className="section-rule label pt-3 pb-3 text-ink">{t("pastTitle")}</h2>
          <ul>
            {past.map(e => (
              <EventRow key={e.slug} event={e} locale={locale} past labels={labels} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
