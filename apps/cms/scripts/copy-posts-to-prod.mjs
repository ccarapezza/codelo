#!/usr/bin/env node
/**
 * Copia posts publicados del CMS local al CMS de producción vía REST,
 * portada y tags incluidos. Idempotente: si el slug ya existe en destino,
 * lo saltea. No usa OpenAI ni el pipeline de agentes: copia tal cual.
 *
 * Usage:
 *   PROD_TOKEN=<api-token-full-access> \
 *   node scripts/copy-posts-to-prod.mjs "2026-07-22T16:40:00.000Z"
 *
 * Opcional:
 *   LOCAL_URL  default http://localhost:1339
 *   PROD_URL   default https://cms.cogollosdeloeste.com.ar
 *   DRY_RUN=1  lista qué copiaría sin escribir nada
 */

const LOCAL_URL = (process.env.LOCAL_URL ?? "http://localhost:1339").replace(/\/$/, "");
const PROD_URL = (process.env.PROD_URL ?? "https://cms.cogollosdeloeste.com.ar").replace(/\/$/, "");
const PROD_TOKEN = process.env.PROD_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";
const since = process.argv[2];

if (!PROD_TOKEN) {
  console.error("✗ Falta PROD_TOKEN (API token full-access del admin de prod).");
  process.exit(1);
}
if (!since) {
  console.error('✗ Falta el filtro de fecha, ej: node scripts/copy-posts-to-prod.mjs "2026-07-22T16:40:00.000Z"');
  process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${PROD_TOKEN}` };

async function api(base, path, init = {}) {
  const res = await fetch(`${base}${path}`, init);
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${base}${path} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  }
  return json;
}

// 1. Posts publicados en local desde `since`, con portada y tags.
const qs = new URLSearchParams({
  locale: "es",
  status: "published",
  sort: "publishedAt:asc",
  "filters[createdAt][$gte]": since,
  "pagination[limit]": "25",
  "populate[coverImage][fields][0]": "url",
  "populate[coverImage][fields][1]": "alternativeText",
  "populate[tags][fields][0]": "slug",
  "populate[tags][fields][1]": "name",
  "populate[tags][fields][2]": "kind",
});
const local = await api(LOCAL_URL, `/api/posts?${qs}`);
if (!local.data?.length) {
  console.error(`✗ No hay posts publicados en local con createdAt >= ${since}`);
  process.exit(1);
}
console.log(`${local.data.length} posts locales a copiar:\n`);

for (const post of local.data) {
  const label = `"${post.title.slice(0, 60)}…"`;

  // 2. Idempotencia por slug.
  const existing = await api(
    PROD_URL,
    `/api/posts?filters[slug][$eq]=${encodeURIComponent(post.slug)}&locale=es&fields[0]=slug`,
    { headers: authHeaders },
  );
  if (existing.data?.length) {
    console.log(`↷ ya existe en prod, salteado: ${label}`);
    continue;
  }
  if (DRY_RUN) {
    console.log(`→ copiaría: ${label} (cover: ${post.coverImage ? "sí" : "no"}, tags: ${(post.tags ?? []).map((t) => t.slug).join(",") || "—"})`);
    continue;
  }

  // 3. Subir la portada a prod (si hay).
  let coverId = null;
  if (post.coverImage?.url) {
    const imgRes = await fetch(`${LOCAL_URL}${post.coverImage.url}`);
    if (!imgRes.ok) throw new Error(`No pude bajar la portada local de ${label}`);
    const blob = await imgRes.blob();
    const form = new FormData();
    const filename = post.coverImage.url.split("/").pop() ?? `cover-${post.slug}.jpg`;
    form.append("files", blob, filename);
    form.append("fileInfo", JSON.stringify({ alternativeText: post.coverImage.alternativeText ?? post.title }));
    const uploaded = await api(PROD_URL, "/api/upload", { method: "POST", headers: authHeaders, body: form });
    coverId = uploaded[0]?.id ?? null;
    console.log(`  · portada subida (id ${coverId})`);
  }

  // 4. Resolver tags en prod por slug (no se crean: si falta, se avisa y sigue).
  const tagIds = [];
  for (const tag of post.tags ?? []) {
    const found = await api(
      PROD_URL,
      `/api/tags?filters[slug][$eq]=${encodeURIComponent(tag.slug)}&fields[0]=slug`,
      { headers: authHeaders },
    );
    const hit = found.data?.[0];
    if (hit) tagIds.push(hit.documentId);
    else console.warn(`  ⚠ tag "${tag.slug}" no existe en prod; el post va sin esa etiqueta`);
  }

  // 5. Crear publicado directo, preservando el publishedAt escalonado.
  const created = await api(PROD_URL, `/api/posts?status=published`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        authorName: post.authorName,
        locale: "es",
        publishedAt: post.publishedAt,
        ...(coverId ? { coverImage: coverId } : {}),
        ...(tagIds.length ? { tags: tagIds } : {}),
      },
    }),
  });
  console.log(`✓ publicado en prod: ${label} (documentId ${created.data?.documentId})`);
}

console.log("\nListo.");
