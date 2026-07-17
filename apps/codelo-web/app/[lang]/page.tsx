import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PostListItem } from "@/components/PostListItem";
import { LocalTime } from "@/components/LocalTime";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getLatestPosts, type CmsLocale } from "@/lib/cms";
import { getEvents } from "@/lib/content";
import { localizedAlternates } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const t = await getTranslations({ locale: lang, namespace: "site" });
  return {
    description: t("description"),
    alternates: localizedAlternates(lang, ""),
  };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("home");

  const [events, posts] = await Promise.all([
    getEvents({ upcomingOnly: true, limit: 3 }),
    getLatestPosts(6, lang as CmsLocale),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <section>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t("upcomingEvents")}</h2>
          <Link href="/actividades" className="text-sm font-semibold text-primary hover:underline">
            {t("allEvents")} →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.length === 0 ? (
            <p className="text-muted-foreground">{t("noEvents")}</p>
          ) : (
            events.map(event => (
              <Card key={event.slug}>
                <CardHeader>
                  <CardTitle className="text-base">{event.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  <p>
                    <LocalTime iso={event.startsAt} locale={lang as Locale} kind="matchZoned" />
                  </p>
                  {event.place ? <p className="mt-1">{event.place}</p> : null}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </section>

      <section className="mt-16">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-bold tracking-tight">{t("latestNews")}</h2>
          <Link href="/blog" className="text-sm font-semibold text-primary hover:underline">
            {t("allNews")} →
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.length === 0 ? (
            <p className="text-muted-foreground">{t("noPosts")}</p>
          ) : (
            posts.map(post => <PostListItem key={post.slug} post={post} />)
          )}
        </div>
      </section>
    </main>
  );
}
