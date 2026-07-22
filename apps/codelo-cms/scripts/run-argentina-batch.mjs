#!/usr/bin/env node
/**
 * Corrida puntual: tanda de notas con foco en Argentina.
 *
 * Usa el modo "assigned" de runRedactor (el mismo que usa run-batch) para que
 * cada redactor escriba sobre UNA noticia argentina pre-seleccionada, en vez
 * de dejar que el pool general (dominado por feeds internacionales) decida.
 * Los resúmenes se redactaron a mano desde los artículos fuente porque los
 * feeds de Revista THC / El Planteo traen solo un thumbnail como summary.
 *
 * Usage (desde apps/codelo-cms, con el .env cargado):
 *   node scripts/run-argentina-batch.mjs redactores   # crea los 6 borradores
 *   node scripts/run-argentina-batch.mjs director 6   # revisa, portada y publica
 */
import path from "node:path";
import { createRequire } from "node:module";

// La build ESM de @strapi/strapi está rota (importa `lodash/fp` como
// directorio); la CJS es la que usa la propia CLI, así que se carga por require.
const require = createRequire(import.meta.url);
const { createStrapi, compileStrapi } = require("@strapi/strapi");

const mode = process.argv[2] ?? "redactores";

// agentName debe coincidir con el nombre exacto del agente en el admin.
const ASSIGNMENTS = [
  {
    agentName: "Legales y Regulación",
    item: {
      source: "[Cannabis] El Planteo",
      title: "Mendoza reglamenta la investigación con cannabis y cáñamo: requisitos, controles y sanciones",
      url: "https://elplanteo.com/mendoza-reglamenta-la-investigacion-con-cannabis-y-canamo-requisitos-controles-y-sanciones/",
      itemPublishedAt: "2026-07-21T12:00:00.000Z",
      summary:
        "Mendoza aprobó por Resolución 428 (firmada el 15/7/2026 por el ministro de Gobierno Natalio Mema, publicada el 21/7 en el Boletín Oficial provincial) el procedimiento para autorizar, registrar y fiscalizar proyectos de investigación con cannabis y cáñamo. Implementa la Ley provincial 9.617 (abril 2025), que creó el Registro Provincial del Cannabis y Cáñamo Industrial. Pueden presentar proyectos universidades, organismos científicos, laboratorios autorizados y empresas con convenio académico. Exige informes trimestrales e inspecciones; sanciones: multas de 100 a 1.000.000 de Unidades Fijas, clausura y decomiso.",
    },
  },
  {
    agentName: "Industria y Cáñamo",
    item: {
      source: "[Cannabis] Revista THC",
      title: "¿Vendés semillas legales? Cómo inscribirse en ARICCAME para obtener una licencia",
      url: "https://revistathc.com/vendes-semillas-legales-como-inscribirse-en-ariccame-para-obtener-una-licencia/",
      itemPublishedAt: "2026-07-21T12:00:00.000Z",
      summary:
        "Por Resolución 41/2026, ARICCAME abrió la solicitud de licencias para actividades con órganos de propagación de Cannabis sativa con fines medicinales: obtención, conservación, multiplicación, acondicionamiento, almacenamiento, transporte, provisión y comercialización nacional e internacional de semillas (no alcanza flores ni derivados). Requisitos: estar inscripto ante INASE como Comercio Expendedor (categoría F), CUIT prevalidado y actividades declaradas ante ARCA consistentes con el registro. El trámite es por Trámites a Distancia (TAD), con plazo hasta marzo de 2027. La licencia no reemplaza las autorizaciones del INASE.",
    },
  },
  {
    agentName: "Cultura y Comunidad",
    item: {
      source: "[Cannabis] Revista THC",
      title: "Cómo renovar el REPROCANN paso a paso: guía completa para 2026",
      url: "https://revistathc.com/como-renovar-el-reprocann-paso-a-paso-guia-completa-para-2026/",
      itemPublishedAt: "2026-07-21T12:00:00.000Z",
      summary:
        "Guía de Revista THC para renovar el REPROCANN en 2026: la autorización de autocultivo vale 3 años; la vinculada a asociaciones civiles y fundaciones, 1 año. Requisitos: cuenta activa en Mi Argentina, indicación médica vigente y datos de domicilio, profesional y cultivador solidario u organización actualizados. Pasos: el profesional genera la nueva solicitud, el paciente la revisa y confirma, y el expediente queda «pendiente de evaluación»; conviene conservar el número y controlar el estado. No hay plazo fijo de aprobación (de semanas a meses). Si la autorización venció se puede iniciar un trámite nuevo, pero se pierde la cobertura hasta la aprobación.",
    },
  },
  {
    agentName: "Ambiente y Cultivo Responsable",
    item: {
      source: "[Ambiente] Agencia Tierra Viva",
      title: "Ley de Semillas bajo amenaza: el Gobierno a favor de las corporaciones del agronegocio",
      url: "https://agenciatierraviva.com.ar/ley-de-semillas-bajo-amenaza-el-gobierno-a-favor-de-las-corporaciones-del-agronegocio/",
      itemPublishedAt: "2026-07-22T12:00:00.000Z",
      summary:
        "Dos resoluciones modifican de facto la Ley de Semillas 20.247 y afectan el uso propio de los agricultores (reservar semilla de la cosecha para resembrar), que quedaría reducido a excepción con regalías, según Agencia Tierra Viva: la Resolución Conjunta 3 (firmada por Martín Famulari, INASE, y Sergio Iraeta, Secretaría de Agricultura; junio 2026) habilita la toma de muestras descentralizada por empresas privadas en campos y acopios para identificar identidad varietal, y la Resolución 197 del INPI (19/6/2026) derogó la Resolución 283, allanando el patentamiento de secuencias genéticas. Organizaciones campesinas advierten tensión con UPOV 78 y el Tratado de Recursos Fitogenéticos.",
    },
  },
  {
    agentName: "Política de Drogas",
    item: {
      source: "[Cannabis] Revista THC",
      title: "Cuánto cuesta el gramo de cannabis en Argentina en 2026",
      url: "https://revistathc.com/cuanto-cuesta-el-gramo-de-cannabis-en-argentina-en-2026/",
      itemPublishedAt: "2026-07-21T12:00:00.000Z",
      summary:
        "El precio del gramo de cannabis en Argentina en 2026 oscila entre $6.000 y $20.000 según calidad y provincia, con mediana nacional de ~$10.500 (calidad alta ~$12.500, media ~$10.500, baja ~$8.500), según relevamiento de Revista THC. Más caro en Santa Cruz y Chubut (~$20.000) y Neuquén (~$19.000); AMBA ~$10.000; más barato en Jujuy (~$6.000). Los intermediarios agregan 21–27% de sobreprecio. No hay mercado regulado: toda venta está prohibida y el acceso circula por autocultivo, asociaciones civiles, clubes y mercado ilegal. Presión de costos: tarifas eléctricas e insumos importados.",
    },
  },
  {
    agentName: "Ciencia y Salud",
    item: {
      source: "[AR] Infobae",
      title: "El cannabis medicinal podría ayudar con la agitación de la demencia",
      url: "https://www.infobae.com/america/the-new-york-times/2026/07/19/el-cannabis-medicinal-podria-ayudar-con-la-agitacion-de-la-demencia/",
      itemPublishedAt: "2026-07-19T12:00:00.000Z",
      summary:
        "El ensayo LIBBY (fase 2, resultados preliminares sin revisión por pares) reportó que la agitación mejoró en el 87% de los pacientes con demencia tratados con cannabis medicinal contra el 24% con placebo a las 12 semanas. Presentado en la Conferencia Internacional de la Asociación de Alzheimer (Londres, julio 2026); aceite oral con 2 mg de THC y 100 mg de CBD por ml, 120 pacientes con demencia avanzada (edad promedio 81 años) en 10 centros de EE.UU., financiado por el NIH. Investigador principal: Jacobo Mintzer (Universidad Médica de Carolina del Sur). Expertos advierten: formulación experimental no aprobada por la FDA, solo bajo supervisión médica.",
    },
  },
];

// Resúmenes verificados (redactados desde los artículos fuente) para los ítems
// de news-context cuyos feeds solo traen un thumbnail como summary. El Director
// verifica los borradores contra estos resúmenes (primeros 300 chars), así que
// los hechos duros van al frente. Sin esto, rechaza las notas como "inventadas".
const NEWS_SUMMARY_FIXES = ASSIGNMENTS.map(({ item }) => ({
  url: item.url,
  summary: item.summary,
}));

const appContext = await compileStrapi();
const app = await createStrapi(appContext).load();

try {
  const runner = require(path.join(app.dirs.dist.root, "src", "lib", "agent-runner.js"));

  if (mode === "prep") {
    for (const fix of NEWS_SUMMARY_FIXES) {
      const [doc] = (await app.documents("api::news-context.news-context").findMany({
        filters: { url: fix.url },
        limit: 1,
      }));
      if (!doc) {
        console.warn(`⚠ news-context no encontrado: ${fix.url}`);
        continue;
      }
      await app.documents("api::news-context.news-context").update({
        documentId: doc.documentId,
        data: { summary: fix.summary },
      });
      console.log(`→ summary actualizado: ${fix.url}`);
    }
    const since = process.argv[3];
    if (since) {
      const rejected = (await app.documents("api::post.post").findMany({
        status: "draft",
        filters: {
          directorRejectionReason: { $notNull: true },
          createdAt: { $gte: since },
        },
        fields: ["title", "directorRejectionReason"],
        limit: 50,
      }));
      for (const d of rejected) {
        await app.documents("api::post.post").update({
          documentId: d.documentId,
          data: { directorRejectionReason: null },
          status: "draft",
        });
        console.log(`→ rechazo despejado: "${d.title}"`);
      }
    }
  } else if (mode === "publicar") {
    // Rescate humano de los borradores rechazados por el falso positivo del
    // Director (la fuente no llega a su contexto de revisión — ver comentario
    // en runDirector sobre por qué se archiva en vez de borrar). Publica los
    // borradores de la corrida indicada con published_at escalonado (35 min)
    // para que la home no muestre 5 notas con el mismo minuto. Las portadas
    // se generan después con POST /api/post/regenerate-cover-internal.
    const since = process.argv[3] ?? "2026-07-22T16:40:00.000Z";
    const drafts = (await app.documents("api::post.post").findMany({
      status: "draft",
      filters: { createdAt: { $gte: since } },
      fields: ["title", "directorRejectionReason"],
      limit: 20,
    }));
    let n = 0;
    for (const draft of drafts) {
      if (draft.directorRejectionReason) {
        await app.documents("api::post.post").update({
          documentId: draft.documentId,
          data: { directorRejectionReason: null },
          status: "draft",
        });
      }
      await app.documents("api::post.post").publish({ documentId: draft.documentId });
      if (n > 0) {
        const staggered = new Date(Date.now() - n * 35 * 60 * 1000);
        await app.db
          .connection("posts")
          .where({ document_id: draft.documentId, locale: "es" })
          .whereNotNull("published_at")
          .update({ published_at: staggered });
      }
      n++;
      console.log(`→ publicado: "${draft.title}"`);
    }
    console.log(`${n} notas publicadas.`);
  } else if (mode === "debug-review") {
    // Reconstruye el contexto de revisión del Director para cada borrador
    // rechazado de hoy y muestra si el ítem fuente aparece y en qué posición.
    const fetcher = require(path.join(app.dirs.dist.root, "src", "lib", "rss-fetcher.js"));
    const drafts = (await app.documents("api::post.post").findMany({
      status: "draft",
      filters: { createdAt: { $gte: process.argv[3] ?? "2026-07-22T16:40:00.000Z" } },
      fields: ["title", "excerpt", "directorRejectionReason"],
      limit: 20,
    }));
    for (const draft of drafts) {
      const draftQuery = `${draft.title ?? ""} ${draft.excerpt ?? ""}`;
      const [keywordNews, broadNews] = await Promise.all([
        fetcher.getRecentNewsForTopic(app, draftQuery, 25),
        fetcher.getRecentNewsForTopic(app, "", 40),
      ]);
      const byUrl = new Map();
      for (const n of [...keywordNews, ...broadNews]) {
        if (!byUrl.has(n.url)) byUrl.set(n.url, n);
      }
      const finalNews = Array.from(byUrl.values()).slice(0, 50);
      const expected = ASSIGNMENTS.find((a) =>
        draft.title.toLowerCase().includes(a.item.title.slice(0, 12).toLowerCase()) ||
        a.item.summary.slice(0, 40) === (finalNews[0]?.summary ?? "").slice(0, 40),
      );
      console.log(`\n=== "${draft.title}"`);
      console.log(`   contexto: ${finalNews.length} items (${keywordNews.length} por keyword)`);
      finalNews.slice(0, 8).forEach((n, i) =>
        console.log(`   [${i + 1}] ${n.source} | ${n.title.slice(0, 70)}`),
      );
      for (const a of ASSIGNMENTS) {
        const pos = finalNews.findIndex((n) => n.url === a.item.url);
        if (pos >= 0) console.log(`   → fuente "${a.item.title.slice(0, 40)}…" en posición ${pos + 1}, summary: ${finalNews[pos].summary.slice(0, 80)}`);
      }
    }
  } else if (mode === "redactores") {
    for (const { agentName, item } of ASSIGNMENTS) {
      if (item.summary.length > 600) {
        // runRedactor corta el summary asignado en 600 chars: avisar si se pierde cola.
        console.warn(`⚠ summary de "${agentName}" tiene ${item.summary.length} chars (se corta en 600)`);
      }
      const [agent] = (await app.documents("api::agent.agent").findMany({
        filters: { name: agentName },
        populate: ["defaultTag", "schedules"],
        limit: 1,
      }));
      if (!agent) {
        console.error(`✗ Agente no encontrado: ${agentName}`);
        continue;
      }
      console.log(`→ ${agentName}: "${item.title}"`);
      await runner.runRedactor(app, agent, 1, [
        { ...item, itemPublishedAt: new Date(item.itemPublishedAt) },
      ]);
    }
  } else if (mode === "director") {
    const notesCount = Number(process.argv[3] ?? ASSIGNMENTS.length);
    const [director] = (await app.documents("api::agent.agent").findMany({
      filters: { role: "director" },
      limit: 1,
    }));
    if (!director) throw new Error("No hay agente director configurado.");
    console.log(`→ Director "${director.name}": revisar y publicar hasta ${notesCount} notas`);
    await runner.runAgentNow(app, director.documentId, notesCount);
  } else {
    throw new Error(`Modo desconocido: ${mode} (usar "redactores" o "director")`);
  }
  console.log("✓ Listo.");
} finally {
  await app.destroy();
}
