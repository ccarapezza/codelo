import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { markdownToSafeHtml } from "@/lib/markdown";
import type { CmsPage } from "@/lib/content";
import { cn } from "@/lib/utils";

// Renderer compartido de las páginas estáticas del CMS (quiénes somos,
// REPROCANN, contacto…). El contenido es markdown escrito en el admin.
export async function CmsPageView({ page, eyebrow }: { page: CmsPage | null; eyebrow?: string }) {
  const t = await getTranslations("pages");

  if (!page) {
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-20 sm:px-8">
        <p className="section-rule pt-4 font-serif text-muted-foreground">{t("missing")}</p>
      </main>
    );
  }

  const safeHtml = markdownToSafeHtml(page.content);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
      <header className="section-rule pt-5 pb-8">
        {eyebrow ? <p className="label text-ember">{eyebrow}</p> : null}
        <h1
          className={cn(
            "text-[clamp(2.25rem,5vw,4rem)] leading-[0.98] font-semibold tracking-tight text-balance",
            eyebrow && "mt-3",
          )}
        >
          {page.title}
        </h1>
        {page.seoDescription ? (
          <p className="mt-3 font-serif text-lg leading-relaxed text-muted-foreground">
            {page.seoDescription}
          </p>
        ) : null}
      </header>

      {page.coverImageUrl ? (
        <div className="duotone relative mb-10 aspect-[2/1] w-full overflow-hidden">
          <Image
            src={page.coverImageUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
          />
        </div>
      ) : null}

      {/* Mismo tratamiento de lectura que el artículo: cuerpo en Literata y
          todo lo destacable en la segunda tinta, que es lo que hace una
          impresión a dos colores. */}
      <article
        className={cn(
          "prose prose-xl max-w-none border-t border-rule pt-10",
          "prose-headings:tracking-tight prose-headings:text-foreground",
          "prose-h2:mt-12 prose-h2:mb-4 prose-h2:text-2xl prose-h2:border-b prose-h2:border-rule prose-h2:pb-2 sm:prose-h2:text-3xl",
          "prose-h3:mt-8 prose-h3:text-xl",
          "prose-p:font-serif prose-p:leading-[1.75] prose-p:text-foreground/90",
          "prose-strong:font-semibold prose-strong:text-foreground",
          "prose-a:text-ember prose-a:font-medium prose-a:no-underline hover:prose-a:underline",
          "prose-blockquote:my-10 prose-blockquote:border-l-0 prose-blockquote:border-y prose-blockquote:border-ember/35 prose-blockquote:bg-transparent prose-blockquote:px-0 prose-blockquote:py-6 prose-blockquote:not-italic prose-blockquote:font-serif prose-blockquote:text-xl prose-blockquote:leading-snug prose-blockquote:text-ember",
          "prose-ul:font-serif prose-ol:font-serif prose-li:leading-[1.7] prose-li:text-foreground/90 prose-li:marker:text-ember",
          "prose-hr:my-12 prose-hr:border-rule",
          "prose-img:border prose-img:border-rule",
        )}
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </main>
  );
}
