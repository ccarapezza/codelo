import { getTranslations } from "next-intl/server";
import { markdownToSafeHtml } from "@/lib/markdown";
import type { CmsPage } from "@/lib/content";
import { cn } from "@/lib/utils";

// Shared renderer for CMS-managed static pages (quiénes somos, REPROCANN,
// contacto…). The page content is markdown authored in the Strapi admin.
export async function CmsPageView({ page }: { page: CmsPage | null }) {
  const t = await getTranslations("pages");

  if (!page) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-16">
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          {t("missing")}
        </div>
      </main>
    );
  }

  const safeHtml = markdownToSafeHtml(page.content);
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight">{page.title}</h1>
      <article
        className={cn(
          "prose prose-neutral dark:prose-invert mt-8 max-w-none",
          "prose-headings:tracking-tight prose-a:text-primary",
        )}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </main>
  );
}
