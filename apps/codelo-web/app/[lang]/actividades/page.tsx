import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/LocalTime";
import type { Locale } from "@/i18n/routing";
import { getEvents } from "@/lib/content";
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
    alternates: localizedAlternates(lang, "/actividades"),
  };
}

export default async function ActividadesPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("events");

  const events = await getEvents();
  const now = Date.now();
  const upcoming = events
    .filter(e => new Date(e.startsAt).getTime() >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = events.filter(e => new Date(e.startsAt).getTime() < now);

  const renderEvent = (event: (typeof events)[number], isPast = false) => (
    <Card key={event.slug} className={isPast ? "opacity-70" : undefined}>
      <CardHeader>
        <CardTitle className="flex items-start justify-between gap-2 text-base">
          <span>{event.title}</span>
          <Badge variant={isPast ? "secondary" : "default"}>
            {isPast ? t("past") : t("upcoming")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          <LocalTime iso={event.startsAt} locale={lang as Locale} kind="matchZoned" />
          {event.place ? ` · ${event.place}` : null}
        </p>
        {event.description ? (
          <div
            className="prose prose-sm prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownToSafeHtml(event.description) }}
          />
        ) : null}
      </CardContent>
    </Card>
  );

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("upcomingTitle")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {upcoming.length === 0 ? (
            <p className="text-muted-foreground">{t("emptyUpcoming")}</p>
          ) : (
            upcoming.map(e => renderEvent(e))
          )}
        </div>
      </section>

      {past.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">{t("pastTitle")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{past.map(e => renderEvent(e, true))}</div>
        </section>
      ) : null}
    </main>
  );
}
