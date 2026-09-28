#!/usr/bin/env node
/**
 * Detecta notas publicadas cuyo título calca el titular de una fuente RSS
 * guardada en news-context — el problema que la compuerta de
 * src/lib/headline-similarity.ts evita hacia adelante. Este script mira hacia
 * atrás: lista los calcos ya publicados para decidir retítulos. Sólo REPORTA,
 * no modifica nada; si se retitula, se tocan title y excerpt, nunca el slug:
 * la URL ya circuló.
 *
 * Usage (desde apps/cms):
 *   node scripts/find-echoed-titles.mjs local                                  # bootstrap Strapi local
 *   PROD_URL=https://cms.… PROD_TOKEN=… node scripts/find-echoed-titles.mjs prod   # prod vía REST
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const target = process.argv[2];

// ── Copia standalone de src/lib/headline-similarity.ts (fuente de verdad allá;
// los scripts .mjs no pueden importar el TS sin build). La mantiene en sync
// test/echoed-titles-sync.test.ts, que compara esta copia contra el módulo.
const STOPWORDS = new Set([
  "como", "cual", "cuales", "cuanto", "cuanta", "cuantos", "cuantas", "donde",
  "cuando", "para", "por", "con", "sin", "del", "los", "las", "una", "uno",
  "unos", "unas", "que", "quien", "este", "esta", "estos", "estas", "ese",
  "esa", "esos", "esas", "sobre", "entre", "desde", "hasta", "segun", "tras",
  "ante", "asi", "mas", "pero", "muy", "son", "esta", "estan", "ser", "hay",
  "fue", "sera", "hacia", "todo", "toda", "todos", "todas",
  "the", "for", "and", "with", "from", "into", "that", "this", "what", "how",
  "why", "when", "where", "will", "are", "was", "has", "have", "its", "their",
  "about", "after", "before", "over", "under", "not",
]);

function headlineTokens(headline) {
  const normalized = headline.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const tokens = new Set();
  for (const raw of normalized.split(/[^a-z0-9ñ]+/)) {
    if (raw.length < 3) continue;
    if (/^\d{1,3}$/.test(raw)) continue;
    if (STOPWORDS.has(raw)) continue;
    tokens.add(raw.slice(0, 6));
  }
  return tokens;
}

function similarity(candidate, source) {
  const a = headlineTokens(candidate);
  const b = headlineTokens(source);
  if (a.size === 0 || b.size === 0) return { jaccard: 0, containment: 0, hit: false };
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const jaccard = intersection / (a.size + b.size - intersection);
  const containment = intersection / Math.min(a.size, b.size);
  return { jaccard, containment, hit: jaccard >= 0.55 || containment >= 0.8 };
}
// ── fin copia

function report(posts, newsItems) {
  let found = 0;
  for (const post of posts) {
    for (const item of newsItems) {
      const { jaccard, containment, hit } = similarity(post.title, item.title);
      if (!hit) continue;
      found++;
      console.log(
        `\n✗ CALCO (jaccard ${jaccard.toFixed(2)}, containment ${containment.toFixed(2)})` +
          `\n  nota:   "${post.title}"  [${post.slug ?? post.documentId}]` +
          `\n  fuente: "${item.title}"  (${item.source ?? "?"})`,
      );
      break; // un match alcanza para listarla
    }
  }
  console.log(
    `\n${found} calco(s) entre ${posts.length} notas y ${newsItems.length} titulares fuente.`,
  );
}

if (target === "local") {
  const { createStrapi, compileStrapi } = require("@strapi/strapi");
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  try {
    const posts = await app.documents("api::post.post").findMany({
      status: "published",
      fields: ["title", "slug"],
      limit: 1000,
    });
    const newsItems = await app.documents("api::news-context.news-context").findMany({
      fields: ["title", "source"],
      limit: 5000,
    });
    report(posts, newsItems);
  } finally {
    await app.destroy();
  }
} else if (target === "prod") {
  // Sin host por defecto: el script es del motor y no sabe de qué instancia es.
  const PROD_URL = (process.env.PROD_URL ?? "").replace(/\/$/, "");
  const PROD_TOKEN = process.env.PROD_TOKEN;
  if (!PROD_URL || !PROD_TOKEN) {
    console.error("✗ Faltan PROD_URL y/o PROD_TOKEN.");
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${PROD_TOKEN}` };
  async function fetchAll(path, fields) {
    const out = [];
    for (let page = 1; ; page++) {
      const qs = fields.map((f, i) => `fields[${i}]=${f}`).join("&");
      const res = await fetch(
        `${PROD_URL}${path}?${qs}&pagination[page]=${page}&pagination[pageSize]=100`,
        { headers },
      );
      if (!res.ok) {
        console.error(`✗ ${path}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        process.exit(1);
      }
      const json = await res.json();
      out.push(...(json.data ?? []));
      const pg = json.meta?.pagination;
      if (!pg || page >= pg.pageCount) break;
    }
    return out;
  }
  const posts = await fetchAll("/api/posts", ["title", "slug"]);
  const newsItems = await fetchAll("/api/news-contexts", ["title", "source"]);
  report(posts, newsItems);
} else {
  console.error("Usage: node scripts/find-echoed-titles.mjs local|prod");
  process.exit(1);
}
