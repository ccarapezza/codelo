#!/usr/bin/env node
/**
 * Idempotent upsert of `page` entries from the markdown drafts in
 * docs/contenido/*.md (frontmatter: title, slug, seoDescription; body = content).
 * The web maps fixed routes to well-known slugs (quienes-somos, contacto…),
 * so the slug in the frontmatter must match exactly.
 *
 * Usage:
 *   STRAPI_TOKEN=<full-access-token> node apps/codelo-cms/scripts/seed-pages.mjs
 *
 * Optional:
 *   STRAPI_URL  default http://localhost:1339 (point at prod to seed prod)
 *   DRY_RUN=1   report what would change without writing
 */

import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const CONTENT_DIR = fileURLToPath(new URL("../../../docs/contenido/", import.meta.url));
const STRAPI_URL = (process.env.STRAPI_URL ?? "http://localhost:1339").replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!STRAPI_TOKEN) {
  console.error("✗ Missing STRAPI_TOKEN.");
  console.error("  Generate one in Strapi admin → Settings → API Tokens (Full access).");
  process.exit(1);
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

function parseDraft(raw, filename) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${filename}: missing frontmatter (--- block)`);
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  const content = match[2].trim();
  for (const field of ["title", "slug"]) {
    if (!meta[field]) throw new Error(`${filename}: frontmatter is missing "${field}"`);
  }
  if (!content) throw new Error(`${filename}: empty body`);
  return {
    title: meta.title,
    slug: meta.slug,
    seoDescription: meta.seoDescription ?? null,
    content,
  };
}

async function upsertPage(draft) {
  // status=draft also matches documents whose draft exists but was never
  // published — the default (published-only) view would miss those and the
  // POST would then fail on the unique slug.
  const found = await strapi(
    `/api/pages?filters[slug][$eq]=${encodeURIComponent(draft.slug)}&status=draft`,
  );
  const existing = found.data?.[0];
  const data = {
    title: draft.title,
    slug: draft.slug,
    content: draft.content,
    seoDescription: draft.seoDescription,
  };

  if (DRY_RUN) {
    const action = existing ? `update (documentId=${existing.documentId})` : "create";
    console.log(`  · ${draft.slug} — would ${action} (${draft.content.length} chars)`);
    return;
  }

  if (existing) {
    await strapi(`/api/pages/${existing.documentId}?status=published`, {
      method: "PUT",
      body: JSON.stringify({ data }),
    });
    console.log(`  · ${draft.slug} — updated + published`);
  } else {
    await strapi(`/api/pages?status=published`, {
      method: "POST",
      body: JSON.stringify({ data }),
    });
    console.log(`  · ${draft.slug} — created + published`);
  }
}

async function main() {
  console.log(`→ ${STRAPI_URL}${DRY_RUN ? " (dry run)" : ""}`);
  const files = (await readdir(CONTENT_DIR)).filter((f) => f.endsWith(".md")).sort();
  if (!files.length) {
    console.error(`✗ No .md drafts found in ${CONTENT_DIR}`);
    process.exit(1);
  }
  for (const file of files) {
    const draft = parseDraft(await readFile(`${CONTENT_DIR}${file}`, "utf8"), file);
    await upsertPage(draft);
  }
  console.log("\n✓ Done.");
}

main().catch((err) => {
  console.error("✗ Failed:", err.message);
  process.exit(1);
});
