#!/usr/bin/env node
/**
 * Idempotent seed: creates test posts for layout/pipeline checks,
 * supporting tags, and (when OPENAI_API_KEY is set) AI-generated cover images
 * uploaded to Strapi and attached to each post.
 *
 * Usage:
 *   STRAPI_TOKEN=<full-access-token> \
 *   OPENAI_API_KEY=<sk-...> \           # optional — skip to seed without images
 *   node apps/codelo-cms/scripts/seed-test-post.mjs
 *
 * Optional:
 *   STRAPI_URL  default http://localhost:1339
 *   IMG_QUALITY default "medium" (gpt-image-1 supports low|medium|high)
 *   IMG_SIZE    default "1536x1024" (3:2 — closest to 16:9 in gpt-image-1)
 */

const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1339").replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IMG_QUALITY = process.env.IMG_QUALITY ?? "medium";
const IMG_SIZE = process.env.IMG_SIZE ?? "1536x1024";

if (!STRAPI_TOKEN) {
  console.error("✗ Missing STRAPI_TOKEN.");
  console.error("  Generate one in Strapi admin → Settings → API Tokens (Full access).");
  process.exit(1);
}

if (!OPENAI_API_KEY) {
  console.warn("⚠ No OPENAI_API_KEY — skipping cover image generation. Posts will be seeded without images.");
}

const headers = {
  Authorization: `Bearer ${STRAPI_TOKEN}`,
  "Content-Type": "application/json",
};

async function strapi(path, init = {}) {
  const res = await fetch(`${STRAPI_URL}${path}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  }
  return json;
}

async function findOrCreateTag({ name, slug, kind, reference }) {
  const found = await strapi(`/api/tags?filters[slug][$eq]=${encodeURIComponent(slug)}`);
  const existing = found.data?.[0];
  if (existing) return existing.id;
  const created = await strapi(`/api/tags`, {
    method: "POST",
    body: JSON.stringify({ data: { name, slug, kind, reference } }),
  });
  return created.data.id;
}

async function generateImage(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: IMG_SIZE,
      quality: IMG_QUALITY,
      n: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI image: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI image: no b64_json in response");
  return Buffer.from(b64, "base64");
}

async function uploadToStrapi(buffer, filename, alt) {
  const fd = new FormData();
  const blob = new Blob([buffer], { type: "image/png" });
  fd.append("files", blob, filename);
  if (alt) {
    fd.append("fileInfo", JSON.stringify({ alternativeText: alt, caption: alt }));
  }
  const res = await fetch(`${STRAPI_URL}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_TOKEN}` },
    body: fd,
  });
  if (!res.ok) {
    throw new Error(`Strapi upload: ${res.status} ${await res.text()}`);
  }
  const arr = await res.json();
  return arr[0].id;
}

const TAG_DEFS = [
  { name: "REPROCANN", slug: "reprocann", kind: "topic", reference: null },
  { name: "Legales", slug: "legales", kind: "topic", reference: null },
  { name: "Ciencia", slug: "ciencia", kind: "topic", reference: null },
  { name: "Cáñamo", slug: "canamo", kind: "topic", reference: null },
  { name: "Ambiente", slug: "ambiente", kind: "topic", reference: null },
  { name: "Comunidad", slug: "comunidad", kind: "topic", reference: null },
];

const PROMPT_BASE =
  "Editorial photography, photorealistic, magazine cover style, natural light, cinematic depth of field, botanical and community-oriented. No text, no watermarks, no logos, no brand labels, no faces, no smoking or consumption imagery.";

// Contenido de PRUEBA para revisar maquetación y ejercitar el pipeline sin
// gastar en los agentes. Deliberadamente genérico: no afirma hechos concretos
// que puedan confundirse con información real. Borralo antes de producción.
const POSTS = [
  {
    slug: "prueba-marco-legal-y-tramites",
    title: "Marco legal y trámites: por dónde empezar",
    excerpt:
      "Nota de prueba: qué distingue una norma vigente de un proyecto en discusión, y por qué importa al informarse.",
    tags: ["legales", "reprocann"],
    imagePrompt: `${PROMPT_BASE} Generic paperwork fanned on a wooden desk beside a small potted plant, warm morning light, no readable text.`,
    imageAlt: "Documentación sobre un escritorio junto a una planta en maceta",
    content: `Entender el marco regulatorio exige una distinción que se pierde seguido en la conversación pública: **no es lo mismo una norma vigente que un proyecto en discusión**.

## Vigente, proyecto o media sanción

Un proyecto presentado no cambia nada por sí solo. Una media sanción tampoco. Solo el texto publicado y en vigencia obliga, y sus plazos y requisitos son los que valen a la hora de un trámite.

> Informarse bien es, sobre todo, saber en qué etapa está cada cosa.

## Dónde verificar

Ante cualquier gestión concreta, la fuente oficial es la que manda. Esta nota es material de prueba y no reemplaza asesoramiento.`,
  },
  {
    slug: "prueba-plantas-hongos-y-divulgacion",
    title: "Plantas, hongos y el trabajo de divulgar",
    excerpt:
      "Nota de prueba: cómo se lee un estudio, qué es un preprint y por qué la diferencia entre promisorio y probado no es un detalle.",
    tags: ["ciencia", "ambiente"],
    imagePrompt: `${PROMPT_BASE} Macro close-up of green leaves at backlight with dew drops, shallow depth of field, golden morning light, no people.`,
    imageAlt: "Macro de hojas verdes a contraluz con gotas de rocío",
    content: `La divulgación seria sobre plantas y hongos empieza por una pregunta simple: **¿qué tan sólido es lo que estoy leyendo?**

## Preprint no es paper revisado

Un preprint es un trabajo publicado antes de la revisión por pares. Puede ser excelente o puede no sobrevivir a la revisión. Citarlo está bien; presentarlo como ciencia establecida, no.

## Las limitaciones importan

Tamaño de muestra, si el trabajo es in vitro, en animales o en personas, si es observacional o experimental: esos datos cambian por completo el alcance de una conclusión.

> "Promisorio" no es "probado", y la diferencia suele decidirse en el título.

Esta nota es material de prueba para validar la maquetación del portal.`,
  },
];

async function findOrCreatePost(post, tagBySlug) {
  const existing = await strapi(
    `/api/posts?filters[slug][$eq]=${encodeURIComponent(post.slug)}&populate=coverImage`,
  );
  if (existing.data?.[0]) {
    return { post: existing.data[0], created: false };
  }
  const tagIds = post.tagSlugs.map((slug) => tagBySlug[slug]).filter(Boolean);
  const created = await strapi(`/api/posts`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        tags: tagIds,
        publishedAt: new Date().toISOString(),
      },
    }),
  });
  return { post: created.data, created: true };
}

async function ensureCoverImage(strapiPost, def) {
  if (!OPENAI_API_KEY) return false;
  if (!def.imagePrompt) return false;
  if (strapiPost.coverImage) return false;

  console.log(`    ↻ generating cover (${IMG_SIZE}, ${IMG_QUALITY})…`);
  const buffer = await generateImage(def.imagePrompt);
  const filename = `${def.slug}.png`;
  const mediaId = await uploadToStrapi(buffer, filename, def.imageAlt ?? def.title);
  console.log(`    ↥ uploaded media id=${mediaId}`);

  const documentId = strapiPost.documentId ?? strapiPost.id;
  await strapi(`/api/posts/${documentId}`, {
    method: "PUT",
    body: JSON.stringify({ data: { coverImage: mediaId } }),
  });
  return true;
}

async function main() {
  console.log(`→ ${STRAPI_URL}`);

  console.log("→ Tags");
  const tagBySlug = {};
  for (const def of TAG_DEFS) {
    tagBySlug[def.slug] = await findOrCreateTag(def);
  }
  console.log(`  · ${Object.keys(tagBySlug).length} tags ready`);

  console.log("→ Posts");
  for (const def of POSTS) {
    const { post, created } = await findOrCreatePost(def, tagBySlug);
    console.log(`  · ${def.slug} — ${created ? "created" : "exists"} (id=${post.id})`);

    // Even for existing posts, fetch with populate to know if cover needs generating.
    const populated = created
      ? (await strapi(`/api/posts/${post.documentId ?? post.id}?populate=coverImage`)).data
      : post;

    try {
      const generated = await ensureCoverImage(populated, def);
      if (generated) console.log(`    ✓ cover image attached`);
    } catch (err) {
      console.error(`    ✗ cover image failed: ${err.message}`);
    }
  }

  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
