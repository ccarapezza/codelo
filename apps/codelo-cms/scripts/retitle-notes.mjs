#!/usr/bin/env node
/**
 * Retitula las notas de la tanda 2026-07-22 cuyos títulos calcaban el titular
 * de la fuente (ver src/lib/headline-similarity.ts — la compuerta que evita
 * que vuelva a pasar). Slug y URL no cambian: solo title y excerpt.
 * También corrige el typo del copete de la nota de la Ley de Semillas.
 *
 * Usage:
 *   node scripts/retitle-notes.mjs local            # aplica en el CMS local (bootstrap Strapi)
 *   PROD_TOKEN=... node scripts/retitle-notes.mjs prod   # aplica en prod vía REST
 */
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const target = process.argv[2];

const CHANGES = [
  {
    slugPrefix: "como-renovar-el-reprocann",
    title: "Renovar el REPROCANN a tiempo: vigencias, requisitos y demoras del trámite",
    excerpt:
      "La autorización de autocultivo dura tres años y la vinculada a una organización, solo uno; la aprobación puede demorar meses. Qué tener listo antes del vencimiento para no quedarse sin cobertura.",
  },
  {
    slugPrefix: "mendoza-aprueba-reglamentacion",
    title: "Investigar cannabis en Mendoza: la provincia definió el circuito para autorizar y fiscalizar proyectos",
    excerpt:
      "Con la Resolución 428, el Gobierno provincial puso en marcha el procedimiento que implementa la Ley 9.617: evaluación previa, ingreso al registro, informes trimestrales e inspecciones para cada proyecto científico.",
  },
  {
    slugPrefix: "el-precio-del-gramo-de-cannabis",
    title: "La brecha federal del cannabis: el valor de un gramo se triplica según la provincia",
    excerpt:
      "El relevamiento provincial muestra medianas de $20.000 en la Patagonia austral, $10.000 en el AMBA y $6.000 en Jujuy, con intermediarios que agregan hasta un 27% de sobreprecio en un mercado sin regulación.",
  },
  {
    slugPrefix: "modificaciones-a-la-ley-de-semillas",
    // El título ya era original; solo se corrige el typo "argentinoponen".
    excerpt:
      "Dos resoluciones del Gobierno argentino ponen en riesgo la Ley de Semillas 20.247, limitando el uso propio de semillas por parte de los agricultores.",
  },
];

if (target === "local") {
  const { createStrapi, compileStrapi } = require("@strapi/strapi");
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  try {
    for (const change of CHANGES) {
      const [post] = (await app.documents("api::post.post").findMany({
        filters: { slug: { $startsWith: change.slugPrefix } },
        status: "published",
        fields: ["title", "slug"],
        limit: 1,
      }));
      if (!post) {
        console.warn(`⚠ no encontrado en local: ${change.slugPrefix}`);
        continue;
      }
      const data = { excerpt: change.excerpt };
      if (change.title) data.title = change.title;
      await app.documents("api::post.post").update({
        documentId: post.documentId,
        data,
      });
      await app.documents("api::post.post").publish({ documentId: post.documentId });
      console.log(`✓ local: "${post.title.slice(0, 45)}…" → "${(change.title ?? post.title).slice(0, 45)}…"`);
    }
  } finally {
    await app.destroy();
  }
} else if (target === "prod") {
  const PROD_URL = (process.env.PROD_URL ?? "https://cms.cogollosdeloeste.com.ar").replace(/\/$/, "");
  const PROD_TOKEN = process.env.PROD_TOKEN;
  if (!PROD_TOKEN) {
    console.error("✗ Falta PROD_TOKEN.");
    process.exit(1);
  }
  const headers = { Authorization: `Bearer ${PROD_TOKEN}`, "Content-Type": "application/json" };
  for (const change of CHANGES) {
    const found = await fetch(
      `${PROD_URL}/api/posts?filters[slug][$startsWith]=${encodeURIComponent(change.slugPrefix)}&locale=es&fields[0]=title&fields[1]=slug&pagination[limit]=1`,
      { headers },
    ).then((r) => r.json());
    const post = found.data?.[0];
    if (!post) {
      console.warn(`⚠ no encontrado en prod: ${change.slugPrefix}`);
      continue;
    }
    const data = { excerpt: change.excerpt };
    if (change.title) data.title = change.title;
    const res = await fetch(`${PROD_URL}/api/posts/${post.documentId}?status=published&locale=es`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ data }),
    });
    if (!res.ok) {
      console.error(`✗ prod ${change.slugPrefix}: ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    console.log(`✓ prod: "${post.title.slice(0, 45)}…" → "${(change.title ?? post.title).slice(0, 45)}…"`);
  }
} else {
  console.error('Usage: node scripts/retitle-notes.mjs local|prod');
  process.exit(1);
}
console.log("Listo.");
