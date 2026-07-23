import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { Termohigrometro } from "@/components/termohigrometro/Termohigrometro";
import { TermohigrometroSkeleton } from "@/components/termohigrometro/TermohigrometroSkeleton";
import { PostCover } from "@/components/PostCover";
import { PostCoverFallback } from "@/components/PostCoverFallback";
import { LocalTime } from "@/components/LocalTime";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getLatestPosts, type CmsLocale, type CmsPostListItem } from "@/lib/cms";
import { getEvents, getBoletinEntries } from "@/lib/content";
import { formatPostDate } from "@/lib/intl";
import { localizedAlternates } from "@/lib/seo";
import { SemillasRail } from "@/components/SemillasRail";
import { MissionStrip } from "@/components/MissionStrip";
import { AcuerdoRegulacion } from "@/components/AcuerdoRegulacion";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";

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

/** Rubro del Boletín ("Boletín Oficial · RESOLUCIONES" → "RESOLUCIONES"). */
function rubroOf(source: string): string {
  const parts = source.split("·");
  return (parts[1] ?? parts[0] ?? "").trim();
}

/** Quita el prefijo de norma del título ("Ley 27669 — X" → "X"). */
function stripNorma(title: string): { norma: string | null; rest: string } {
  const idx = title.indexOf("—");
  if (idx === -1) return { norma: null, rest: title };
  return { norma: title.slice(0, idx).trim(), rest: title.slice(idx + 1).trim() };
}

function Cover({
  post,
  format,
  sizes,
  priority,
  eager,
  className,
}: {
  post: CmsPostListItem;
  format: "large" | "medium" | "small";
  sizes: string;
  priority?: boolean;
  eager?: boolean;
  className?: string;
}) {
  // `duotone` imprime la portada en las dos tintas del logo (ver globals.css).
  return (
    <div className={`duotone relative overflow-hidden ${className ?? ""}`}>
      {post.coverImage ? (
        <PostCover
          image={post.coverImage}
          alt={post.title}
          format={format}
          sizes={sizes}
          priority={priority}
          eager={eager}
          className="h-full w-full object-cover"
        />
      ) : (
        <PostCoverFallback title={post.title} seed={post.slug} />
      )}
    </div>
  );
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("home");
  const locale = lang as Locale;

  const [events, posts, boletin] = await Promise.all([
    getEvents({ upcomingOnly: true, limit: 3 }),
    getLatestPosts(30, lang as CmsLocale),
    getBoletinEntries(5),
  ]);

  // Tres escalones de jerarquía en vez de "una grande + cuatro iguales": el
  // ritmo desparejo es lo que hace que una portada se lea como portada.
  const featured = posts.slice(0, 3); // carrusel de portada
  const rest = posts.slice(featured.length);
  const medium = rest.slice(0, 2); // con portada 16:9 y titular mediano
  const compact = rest.slice(2, 6); // miniatura + titular

  // Secciones por ETIQUETA. Cada redactor adjunta su `defaultTag` a lo que
  // escribe, y las notas manuales del generador se etiquetan a mano: así lo
  // reactivo (agentes sobre RSS) y lo atemporal (historia, mitos, personajes,
  // que ningún feed trae) conviven en la misma estructura.
  //
  // El orden lo define el propio contenido: la sección con más notas va
  // primero. Una etiqueta nueva creada en el admin aparece sola, sin tocar
  // código; si no tiene bajada declarada, se muestra igual sin ella.
  const used = new Set([...featured, ...medium, ...compact].filter(Boolean).map(p => p.slug));
  const notes = t.raw("beatNotes") as Record<string, string>;

  const byTag = new Map<string, { label: string; posts: typeof posts }>();
  for (const post of posts) {
    if (used.has(post.slug)) continue;
    const tag = post.tags?.find(tg => tg.kind === "topic") ?? post.tags?.[0];
    if (!tag) continue;
    const entry = byTag.get(tag.slug) ?? { label: tag.name, posts: [] };
    entry.posts.push(post);
    byTag.set(tag.slug, entry);
  }

  const sections = [...byTag.entries()]
    .map(([slug, v]) => ({
      slug,
      label: v.label,
      note: notes[slug] ?? null,
      posts: v.posts.slice(0, 4),
    }))
    .sort((a, b) => b.posts.length - a.posts.length);

  // Riel "Últimas": SOLO lo que no entró en ningún lado de esta página. Repetir
  // en la columna un titular que el ojo acaba de ver a la izquierda hace que el
  // sitio se sienta más chico, no más grande — por eso se descuenta también lo
  // que cada sección ya muestra, no únicamente las destacadas.
  const rendered = new Set(used);
  for (const s of sections) for (const p of s.posts) rendered.add(p.slug);
  const railLatest = posts.filter(p => !rendered.has(p.slug)).slice(0, 8);

  // Índice por área: cuenta sobre TODAS las notas (no sobre lo que sobró), que
  // es lo que el lector espera de un índice. Ordenado por volumen.
  const tagCounts = new Map<string, { label: string; count: number }>();
  for (const post of posts) {
    const tag = post.tags?.find(tg => tg.kind === "topic") ?? post.tags?.[0];
    if (!tag) continue;
    const entry = tagCounts.get(tag.slug) ?? { label: tag.name, count: 0 };
    entry.count += 1;
    tagCounts.set(tag.slug, entry);
  }
  const areaIndex = [...tagCounts.entries()]
    .map(([slug, v]) => ({ slug, ...v }))
    .sort((a, b) => b.count - a.count);

  return (
    <main className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
      {/* Declaración de identidad + acceso a las consultas de INASE. La misión
          se compacta a una línea y el espacio que sobra pasa a ser lo único
          accionable arriba del pliegue. */}
      <MissionStrip mission={t("mission")} />

      {/* PORTADA — columna de features + riel normativo, al modo de un diario. */}
      <div className="grid gap-x-10 gap-y-12 border-t border-rule pt-8 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        {/* Columna de contenido. Envuelve la portada Y las secciones por
            área para que el riel corra a lo largo de toda la página en vez
            de cortarse al terminar la portada. `min-w-0` evita que una
            portada ancha estire la columna. */}
        {/* Cuatro piezas, no dos columnas. En el teléfono `display:contents`
            las asciende a ítems directos de la grilla y `order` las intercala:
            portada → instrumentos → resto → riel. Sin esto el riel entero caía
            después de TODAS las secciones, y el termohigrómetro —que es dato
            de hoy— quedaba a varias pantallas de distancia.
            De `lg` para arriba los envoltorios vuelven a ser bloques y cada
            columna apila en orden de documento: el desktop no cambia. */}
        <div className="contents min-w-0 lg:block">
          <section className="order-1 min-w-0 lg:order-none">
            {featured.length > 0 ? (
              <FeaturedCarousel
                labels={{
                  previous: t("carouselPrev"),
                  next: t("carouselNext"),
                  goTo: t("carouselGoTo"),
                  of: t("carouselOf"),
                }}
              >
                {featured.map((post, i) => (
                  <article key={post.slug}>
                    <Link href={`/blog/${post.slug}`} className="group block">
                      <Cover
                        post={post}
                        format="large"
                        sizes="(min-width: 1024px) 900px, 100vw"
                        // La primera con prioridad —es la que se ve al cargar—
                        // y las otras en `eager`: fuera de pantalla quedarían
                        // lazy, y al avanzar el carrusel se veía el hueco negro
                        // del contenedor en vez de la portada.
                        priority={i === 0}
                        eager={i > 0}
                        className="aspect-[16/9]"
                      />
                      <p className="label mt-5 text-ember">{t("featured")}</p>
                      {/* El h1 va solo en la primera: tres h1 en una página
                          rompen el esquema de encabezados. */}
                      {i === 0 ? (
                        <h1 className="mt-2 text-[clamp(2rem,4.4vw,3.75rem)] leading-[0.98] font-semibold tracking-tight text-balance group-hover:text-ember">
                          {post.title}
                        </h1>
                      ) : (
                        <h2 className="mt-2 text-[clamp(2rem,4.4vw,3.75rem)] leading-[0.98] font-semibold tracking-tight text-balance group-hover:text-ember">
                          {post.title}
                        </h2>
                      )}
                      {post.excerpt ? (
                        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-muted-foreground">
                          {post.excerpt}
                        </p>
                      ) : null}
                    </Link>
                    <p className="label mt-4 text-muted-foreground">
                      {post.authorName ? `${post.authorName} · ` : ""}
                      {post.publishedAt ? formatPostDate(post.publishedAt, locale) : ""}
                    </p>
                  </article>
                ))}
              </FeaturedCarousel>
            ) : (
              <p className="text-muted-foreground">{t("noPosts")}</p>
            )}
          </section>

          <div className="order-3 min-w-0 lg:order-none">
            {/* Escalón 2 — dos notas con portada, a media escala. */}
            {medium.length > 0 ? (
              <div className="mt-12 grid gap-8 border-t border-rule pt-8 sm:grid-cols-2">
                {medium.map(post => (
                  <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                    <Cover
                      post={post}
                      format="medium"
                      sizes="(min-width: 640px) 420px, 100vw"
                      className="aspect-[16/9]"
                    />
                    <h2 className="mt-4 text-2xl leading-tight font-semibold text-balance group-hover:text-ember">
                      {post.title}
                    </h2>
                    {post.excerpt ? (
                      <p className="mt-2 line-clamp-2 font-serif leading-relaxed text-muted-foreground">
                        {post.excerpt}
                      </p>
                    ) : null}
                    <p className="label mt-3 text-muted-foreground">
                      {post.publishedAt ? formatPostDate(post.publishedAt, locale) : ""}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}

            {/* Escalón 3 — miniatura y titular, dos columnas. */}
            {compact.length > 0 ? (
              <div className="mt-10 grid gap-x-8 border-t border-rule sm:grid-cols-2">
                {compact.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group flex gap-4 border-b border-rule py-5 sm:odd:border-r sm:odd:pr-8"
                  >
                    <Cover
                      post={post}
                      format="small"
                      sizes="120px"
                      className="h-20 w-20 shrink-0"
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg leading-tight font-semibold group-hover:text-ember">
                        {post.title}
                      </h2>
                      <p className="label mt-2 text-muted-foreground">
                        {post.publishedAt ? formatPostDate(post.publishedAt, locale) : ""}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {/* SECCIONES POR ÁREA — cada una alterna su distribución para que la
            página tenga ritmo: la primera nota va grande con portada y bajada,
            las siguientes en lista. Las secciones impares invierten el orden de
            las columnas, así el ojo no cae siempre en el mismo lugar. */}
            {sections.map((sec, i) => (
              <section key={sec.slug} className="mt-16">
                <header className="section-rule flex flex-wrap items-baseline gap-x-4 gap-y-1 pt-3 pb-4">
                  <h2 className="label text-ink">{sec.label}</h2>
                  {sec.note ? (
                    <p className="font-serif text-sm text-muted-foreground italic">{sec.note}</p>
                  ) : null}
                </header>

                {/* La distribución se adapta a cuánto material tiene la sección. Con
                una sola nota, la grilla de dos columnas dejaba media sección
                vacía: ahí conviene una pieza ancha, con la portada al costado. */}
                {sec.posts.length === 1 ? (
                  <Link
                    href={`/blog/${sec.posts[0].slug}`}
                    className="group grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-center sm:gap-10"
                  >
                    <Cover
                      post={sec.posts[0]}
                      format="medium"
                      sizes="(min-width: 640px) 560px, 100vw"
                      className="aspect-[16/9]"
                    />
                    <div>
                      <h3 className="text-2xl leading-tight font-semibold text-balance group-hover:text-ember sm:text-3xl">
                        {sec.posts[0].title}
                      </h3>
                      {sec.posts[0].excerpt ? (
                        <p className="mt-3 font-serif leading-relaxed text-muted-foreground">
                          {sec.posts[0].excerpt}
                        </p>
                      ) : null}
                      <p className="label mt-4 text-muted-foreground">
                        {sec.posts[0].publishedAt
                          ? formatPostDate(sec.posts[0].publishedAt, locale)
                          : ""}
                      </p>
                    </div>
                  </Link>
                ) : sec.posts.length === 2 ? (
                  <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
                    {sec.posts.map(post => (
                      <Link key={post.slug} href={`/blog/${post.slug}`} className="group block">
                        <Cover
                          post={post}
                          format="medium"
                          sizes="(min-width: 640px) 420px, 100vw"
                          className="aspect-[16/9]"
                        />
                        <h3 className="mt-4 text-xl leading-tight font-semibold text-balance group-hover:text-ember">
                          {post.title}
                        </h3>
                        {post.excerpt ? (
                          <p className="mt-2 line-clamp-2 font-serif text-sm leading-relaxed text-muted-foreground">
                            {post.excerpt}
                          </p>
                        ) : null}
                        <p className="label mt-3 text-muted-foreground">
                          {post.publishedAt ? formatPostDate(post.publishedAt, locale) : ""}
                        </p>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div
                    className={`grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] ${
                      i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                    }`}
                  >
                    <Link href={`/blog/${sec.posts[0].slug}`} className="group block">
                      <Cover
                        post={sec.posts[0]}
                        format="medium"
                        sizes="(min-width: 1024px) 640px, 100vw"
                        className="aspect-[16/9]"
                      />
                      <h3 className="mt-4 text-2xl leading-tight font-semibold text-balance group-hover:text-ember sm:text-3xl">
                        {sec.posts[0].title}
                      </h3>
                      {sec.posts[0].excerpt ? (
                        <p className="mt-2 line-clamp-3 font-serif leading-relaxed text-muted-foreground">
                          {sec.posts[0].excerpt}
                        </p>
                      ) : null}
                      <p className="label mt-3 text-muted-foreground">
                        {sec.posts[0].publishedAt
                          ? formatPostDate(sec.posts[0].publishedAt, locale)
                          : ""}
                      </p>
                    </Link>

                    <ul className="border-t border-rule lg:border-t-0">
                      {sec.posts.slice(1).map(post => (
                        <li key={post.slug} className="border-b border-rule">
                          <Link href={`/blog/${post.slug}`} className="group flex gap-4 py-4">
                            <Cover
                              post={post}
                              format="small"
                              sizes="96px"
                              className="h-16 w-16 shrink-0"
                            />
                            <div className="min-w-0">
                              <h4 className="leading-snug font-semibold group-hover:text-ember">
                                {post.title}
                              </h4>
                              <p className="label mt-1.5 text-muted-foreground">
                                {post.publishedAt ? formatPostDate(post.publishedAt, locale) : ""}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>
        </div>

        <aside className="contents lg:block">
          {/* Instrumentos: termohigrómetro, Boletín y semillas. En el teléfono
              suben (order-2) para quedar justo debajo de la nota destacada —
              son los tres datos que sirven HOY, no archivo. */}
          <div className="order-2 min-w-0 lg:order-none">
            {/* El fetch del clima vive DENTRO del <Suspense>, no en el Promise.all
              de arriba: si sube ahí, Suspense deja de servir para nada y una
              caída de Open-Meteo le suma hasta 2 s al TTFB de toda la home. */}
            {/* La separación vive acá y no en el componente, para que el riel
              gobierne su propio espaciado y el hueco quede reservado también
              mientras carga. Más corta que el mt-10 que separa al Boletín de la
              agenda: ahí se separan dos secciones distintas, acá el aviso es el
              cierre del propio instrumento. */}
            <div className="mb-6">
              <Suspense fallback={<TermohigrometroSkeleton />}>
                <Termohigrometro locale={locale} />
              </Suspense>
            </div>

            <div className="boletin-panel px-6 py-7">
              <p className="label text-ember">{t("boletinEyebrow")}</p>
              <h2 className="boletin-title mt-2 font-display text-3xl leading-none font-semibold">
                {t("boletinTitle")}
              </h2>
              <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
                {t("boletinExplain")}
              </p>

              {boletin.length === 0 ? (
                <p className="mt-6 font-serif text-sm text-muted-foreground">{t("boletinEmpty")}</p>
              ) : (
                <ol className="mt-6 border-t border-rule">
                  {boletin.map(entry => {
                    const { norma, rest: titulo } = stripNorma(entry.title);
                    return (
                      <li key={entry.url} className="border-b border-rule">
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group block py-3.5"
                        >
                          <div className="label flex flex-wrap items-center gap-x-2 text-ember">
                            <span>{rubroOf(entry.source)}</span>
                            {entry.publishedAt ? (
                              <>
                                <span aria-hidden className="text-rule">
                                  ·
                                </span>
                                <span>{formatPostDate(entry.publishedAt, locale)}</span>
                              </>
                            ) : null}
                          </div>
                          {norma ? (
                            <p className="mt-1 font-mono text-sm font-semibold group-hover:underline">
                              {norma}
                            </p>
                          ) : null}
                          <p className="mt-0.5 font-serif text-sm leading-snug">{titulo}</p>
                          {entry.excerpt ? (
                            <p className="mt-1.5 font-serif text-[0.8125rem] leading-snug text-muted-foreground">
                              {entry.excerpt}
                            </p>
                          ) : null}
                        </a>
                      </li>
                    );
                  })}
                </ol>
              )}

              <a
                href="https://www.boletinoficial.gob.ar/"
                target="_blank"
                rel="noopener noreferrer"
                className="label mt-5 inline-block text-ember hover:underline"
              >
                {t("boletinSource")} →
              </a>
            </div>

            {/* Registros de INASE. Va pegado al panel del Boletín porque son la
              misma clase de cosa: consulta de fuentes oficiales. Antes era una
              banda horizontal de lado a lado, que cortaba el ritmo de la
              página; vertical se lee como un servicio más del riel. */}
            <div className="mt-10">
              <SemillasRail />
            </div>
          </div>

          {/* Lo demás del riel: agenda, últimas, índice y servicios. Va al
              final en el teléfono (order-4) porque es material de archivo. */}
          <div className="order-4 min-w-0 lg:order-none">
            {/* Agenda: fuera del panel, sobre papel — es otra cosa. */}
            <div className="section-rule mt-10 pt-3">
              <h2 className="label text-ink">{t("upcomingEvents")}</h2>
            </div>
            {events.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">{t("noEvents")}</p>
            ) : (
              <ul className="mt-2">
                {events.map(event => (
                  <li key={event.slug} className="border-b border-rule py-4">
                    <p className="label text-ember">
                      <LocalTime iso={event.startsAt} locale={locale} kind="matchZoned" />
                    </p>
                    <p className="mt-1 font-semibold leading-tight">{event.title}</p>
                    {event.place ? (
                      <p className="mt-0.5 font-serif text-sm text-muted-foreground">
                        {event.place}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/actividades"
              className="label mt-4 inline-block text-ember hover:underline"
            >
              {t("allEvents")} →
            </Link>

            {/* ÚLTIMAS — río cronológico al modo de un riel de diario. Sin
              portadas: es un índice para barrer con la vista, no otra grilla.
              Con el catálogo chico puede quedar vacío, y está bien: en ese caso
              lo dice en vez de rellenar con repetidos. */}
            <div className="section-rule mt-10 pt-3">
              <h2 className="label text-ink">{t("latestRail")}</h2>
            </div>
            {railLatest.length === 0 ? (
              <p className="mt-4 font-serif text-sm text-muted-foreground">
                {t("latestRailEmpty")}
              </p>
            ) : (
              <ul className="mt-2">
                {railLatest.map(post => (
                  <li key={post.slug} className="border-b border-rule">
                    <Link href={`/blog/${post.slug}`} className="group block py-3.5">
                      {post.publishedAt ? (
                        <p className="label text-ember">
                          {formatPostDate(post.publishedAt, locale)}
                        </p>
                      ) : null}
                      <p className="mt-1 font-semibold leading-snug group-hover:text-ember">
                        {post.title}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            {/* POR ÁREA — índice del archivo. Crece solo cuando el admin crea una
              etiqueta nueva; no hay lista hardcodeada. */}
            {areaIndex.length > 0 ? (
              <>
                <div className="section-rule mt-10 pt-3">
                  <h2 className="label text-ink">{t("byArea")}</h2>
                </div>
                <ul className="mt-2">
                  {areaIndex.map(area => (
                    <li key={area.slug} className="border-b border-rule">
                      <Link
                        href={`/etiqueta/${area.slug}`}
                        className="group flex items-baseline justify-between gap-3 py-2.5"
                      >
                        <span className="font-serif text-sm leading-snug group-hover:text-ember">
                          {area.label}
                        </span>
                        <span className="label shrink-0 text-muted-foreground">{area.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            {/* ASESORAMIENTO — contenido de servicio, permanente. No compite con
              la portada y responde la consulta real de la gente (REPROCANN).
              El Art. 2° obliga a que quede claro que no somos canal de venta. */}
            <div className="boletin-panel mt-10 px-6 py-7">
              <p className="label text-ember">{t("serviceTitle")}</p>
              <p className="mt-3 font-serif text-sm leading-relaxed text-muted-foreground">
                {t("serviceNote")}
              </p>
              <ul className="mt-5 border-t border-rule">
                {[
                  { href: "/reprocann", label: t("serviceReprocann") },
                  { href: "/quienes-somos", label: t("serviceAbout") },
                  { href: "/contacto", label: t("serviceContact") },
                ].map(link => (
                  <li key={link.href} className="border-b border-rule">
                    <Link
                      href={link.href}
                      className="group block py-3 font-serif text-sm leading-snug"
                    >
                      <span className="group-hover:text-ember">{link.label}</span>
                      <span aria-hidden className="text-ember">
                        {" "}
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <AcuerdoRegulacion />
          </div>
        </aside>
      </div>

      <div className="section-rule mt-16 flex items-baseline justify-between gap-4 pt-3 pb-20">
        <h2 className="label text-ink">{t("latestNews")}</h2>
        <Link href="/blog" className="label text-ember hover:underline">
          {t("allNews")} →
        </Link>
      </div>
    </main>
  );
}
