# Traspaso: fulbo ↔ Nib (discovery del 2026-09-27)

Lo escribió la sesión de fulbo para el agente de Nib. Es el punto de partida para
nivelar las dos puntas: qué tiene que bajar a fulbo, qué tiene que subir al
motor y qué se queda en la vertical de fulbo. Todo lo que dice acá se verificó
contra los repos y contra la base de producción de fulbo; las referencias
`archivo:línea` son de los commits que se nombran.

**Alcance: sólo el CMS (`apps/cms`).** El resto de fulbo —el ingestor
(`apps/fulbo-stats-ingestor`), `packages/db`, la web de fútbol (`apps/web`, que no
entró en la adopción) y torneos— es 100 % vertical, anda muy bien y **no se
toca**.

Refs, desde un clon de fulbo con `upstream` = Nib:

| Ref | Qué es |
| --- | --- |
| `47e1054e` | El CMS de fulbo justo antes de adoptar Nib |
| `875b4134` | La versión de Nib que fulbo adoptó |
| `ba06ba24` | El merge de adopción (`--allow-unrelated-histories`) |
| `3a23e849` | `main` de fulbo hoy (en producción) |
| `upstream/main` (`663dc5e7`) | Nib hoy: 30 commits adelante de lo que fulbo adoptó |

Después de adoptar, fulbo no tocó ningún archivo del motor (el único cambio,
`lib/project.ts`, lo dejó idéntico al de Nib).

---

## 1. Urgente: fulbo corre en producción con prompts de codelo

> **Estado (28-sep): hecho y en producción.** Fulbo `main` = `6d889f83`: merge de
> `upstream/main` (`663dc5e7`), `verticals/seed.ts` y `test/seed.fulbo.test.ts`.
> Probado sobre una copia de la base de prod: el CMS arranca, la semilla
> siembra 18 campos y conserva los 5 editados, y los 23 quedan idénticos a
> `SETTINGS_FULBO`. Los prompts del analista volvieron a tener tarjeta (en
> `admin/verticals.ts` de fulbo, como `promptCards`). Lo que sigue de esta
> sección es el registro de lo que se hizo; lo pendiente de Nib arranca en la
> sección 2.
>
> En prod la semilla sembró 18 campos, conservó los 5 editados y los 23 quedan
> idénticos a la fixture. Los 5 redactores ya tienen `defaultTag =
> futbol-argentino`: desde el 21-sep, 17 de 18 notas habían salido sin tag de
> alcance, y ya se completaron (`backfill-scope-tags.mjs --since --scope`).

Fulbo adoptó `875b4134`, cuando el motor todavía tenía el dominio de codelo
escrito adentro. Hoy, en producción, fulbo le manda al modelo:

- **Dedup** (`lib/openai.ts:349`): "…a non-profit info portal covering cannabis,
  hemp, drug policy…".
- **Traductor** (`:868-872`): se presenta como portal de cannabis y pide no
  traducir 'REPROCANN', 'ARICCAME', *Cannabis sativa*. Cada nota de fulbo que se
  traduce al inglés pasa por acá.
- **Director** (`:802`): la nota sobre fuentes oficiales nombra el Boletín
  Oficial, ARICCAME y ANMAT.
- **Placas de redes** (`social-cards/composer.ts:116,131,151,239`,
  `social-studio/compose-single.ts:46`): la voz de marca de codelo y hashtags por
  defecto `#cannabis #canamo`.
- **Anclas de imagen**: el extractor pide `topic/palette/season` (los de codelo),
  así que los campos de la taxonomía de fulbo (`country`, `teamColors`,
  `jerseyNumber`) se descartan sin error.

`upstream/main` ya lo resolvió: los prompts se arman con campos de
`prompt-setting` y fulbo sólo tiene que cargarlos. **Los valores ya existen**:
`test/preservation/settings.fulbo.ts` se volcó de la producción de fulbo el
22-sep, incluidos los 5 campos que fulbo tiene pisados en su base.

**Qué hace falta (del lado de fulbo, en un merge):**

1. `git merge upstream/main` en fulbo.
2. Escribir `apps/cms/src/verticals/seed.ts` con `SETTINGS_FULBO`, más
   `verticals/setting-fields.ts` para los campos propios del analista. El
   `seed.test.ts` compara contra la fixture.
3. Borrar `verticals/prompt-defaults.ts` de fulbo cuando la semilla lo reemplace.
4. Correr la semilla en producción. Rellena sólo lo vacío, así que los 5 campos
   pisados en la base de prod quedan como están.

**Deltas de clase B que el merge tiene que conservar:**

- enum `analyst` en los `schema.json` de `agent` y `agent-action`. Hay 1 agente
  analista activo en prod; sin el valor en el enum, el CHECK de Postgres tira el
  arranque.
- `post.sourceMatchId`.
- `prompt-setting.analystSystemInstructions` y `analystBodyStructure`.
- **`tag.kind`**: Nib lo dejó en `topic|event`, pero prod de fulbo tiene tags
  `team` (2) y `worldcup` (1). Fulbo tiene que quedar con
  `topic|event|team|worldcup`: mismo problema del CHECK, y el síntoma es que el
  CMS no levanta.

**Después del merge, a mano en prod:**

- `agent.defaultTag = futbol-argentino` en los 5 redactores. En fulbo, el scope
  tag lo ponía el runner en código (`agent-runner.ts:413` en `47e1054e`); Nib lo
  reemplazó por `defaultTag`, que hoy no existe en la base de fulbo. Sin eso, las
  notas nuevas salen sin el tag de alcance. Es la clasificación editorial del
  CMS: la web de fulbo hoy no la usa, así que el hueco no se ve en el sitio.
- Colores de las placas en `verticals/brand.ts`: la adopción corrió los tonos
  (kickers en ámbar, cifras grandes en rojo). Lo de antes: `accentLight=#FF7A00`,
  `accentWarm=#FFB02E`, y `FIRE` sigue siendo el degradé llama→naranja→rojo.
  Referencias: `templates.ts:54,259,355,435,482,537` y `overlays.ts:113,160` en
  `47e1054e`.

---

## 2. Suben al motor (Nib)

Lo que fulbo tenía antes de adoptar y hoy no está **ni en fulbo ni en Nib**. Es
genérico: el contenido de fútbol va por costura (sección 3).

1. **Compuerta anti-calco del generador manual (se perdió entera).** Fulbo la
   tenía en tres piezas: el loop de reintento de `newsGenerate` con
   `findEchoedHeadline` y el `titleWarning` en la respuesta
   (`api/post/controllers/post.ts:526-547`); las reglas de título original y
   bajada con palabras propias en `buildNewsSystemPrompt`
   (`lib/news-generator.ts:91-92`); y el toast de aviso
   (`admin/pages/NewsGeneratorPage/index.tsx:56-60`, hoy `NoteEditorPage`). Hoy
   `findEchoedHeadline` sólo lo usa el redactor automático. Origen: `d3a88016`.
2. **Ventana de frescura de noticias configurable.** Nib fija
   `INGEST_WINDOW_DAYS = 7` y un `since` de 7 días en `getRecentNewsForTopic`
   (`upstream/main:lib/rss-fetcher.ts:136,460`), pensado para los feeds lentos de
   codelo. Fulbo usaba 24 h (`47e1054e:lib/rss-fetcher.ts:86-89,417`): con 7 días,
   un portal deportivo escribe con noticias de hace una semana, y el prompt del
   redactor sigue diciendo "last 24h". Hace falta un setting o env para las dos
   ventanas, y que el texto del prompt salga del mismo valor.
3. **Filtro de relevancia en el redactor en modo libre.** Fulbo filtraba el pool
   con `isEditoriallyRelevant` y, si quedaba vacío, caía al pool entero con un
   warning (`47e1054e:lib/agent-runner.ts:198-211`). Nib sólo filtra en
   `batch-orchestrator.ts:92`. Es genérico: con `rss-scope` vacío pasa todo.
   Origen: `04ac4654`.
4. **El sufijo de imagen única dice "photograph".** Fulbo decía "ONE single
   unified **image**" a propósito, porque "photograph" le pelea a las tapas
   ilustradas, y Nib tiene tratamientos `art` (`lib/openrouter-image.ts:14-18`).
   Origen: `88050ac8`.
5. **Pools de estilo de tapa por proyecto.** El mecanismo del medio sorteado
   sobrevivió como `TreatmentKind`, pero los pools (`TREATMENTS`, `MOODS`,
   `COMPOSITIONS`) están fijos en `openai.ts` y tiran a codelo ("naturalist
   plate", "macro nature photography"). Hace falta una costura para los pools.
   Los de fulbo están en `47e1054e:lib/openai.ts:102-160`.
6. **Ejemplos del dedup configurables.** `buildDedupSystemPrompt` sólo
   parametriza `domainDescription`; los ejemplos son de codelo (ley presentada
   vs. sancionada, licencias), y la fixture `fulbo/dedup.system.txt` lo congela
   así. Hace falta un campo `dedupExamples`. Origen: `ae8e0267`.
7. **Reglas extra del guardarraíl de marca del Director.** Fulbo listaba los
   medios rivales (Olé, Marca, ESPN, TyC…) y la regla "publicamos NUESTROS
   puntajes; nunca reproducir ni atribuir los de un tercero"
   (`47e1054e:lib/openai.ts:848-853`). Nib conserva las reglas genéricas y
   `officialSources`. Hace falta un campo para reglas propias.
8. **AgentsPage no muestra los agentes de un rol del vertical.** El dropdown
   ofrece `verticals.agentRoles`, pero el tablero sólo lista director,
   image-generator y redactor (`upstream/main` ~1271-1273): el analista de fulbo
   se puede crear pero después no se ve, no se edita ni se corre. Fulbo tenía una
   sección "Analistas" con editar, borrar y correr ahora
   (`47e1054e:admin/pages/AgentsPage/index.tsx:1175,1346-1375,1428`). Hace falta
   un `RoleSection` por cada rol del vertical, con etiquetas opcionales por rol.
   Origen: `63c7206b`.
9. **Hook de enriquecimiento de anclas de imagen.** Fulbo resolvía la camiseta
   del club (`CLUB_MARKS`, `resolveTeamMark`, `47e1054e:lib/openai.ts:257-313`), y
   el patrón pisaba `teamColors` en el "MUST FEATURE" (`:469-477`). Se perdió, y
   `imageSystemInstructions` de fulbo todavía dice "when the anchors give you a
   kit pattern, use it". El motor necesita una costura tipo
   `verticals/anchor-enrichers.ts` (anclas → líneas extra); el contenido es de
   fulbo.
10. **Helpers que fulbo tiene en su vertical y son del motor:**
    - `generateCoverAndPublish`: `verticals/analyst.ts` copia unas 150 líneas del
      pipeline tapa → upload → auditoría → publicación de `runDirector`, y ya
      diverge (no pasa `brandPalette`).
    - Un `ensureTagBySlug` genérico, sacado de `verticals/post-tags.ts`
      (`ensureScopeTag`). Sólo `SCOPE_TAGS` es de fulbo.
    - Tag por defecto para las notas creadas a mano, como setting. Fulbo lo hacía
      en `47e1054e:post.ts:714-718` con `"argentino"`.
    - `triggerIngestorJob` (`verticals/cron.ts`): llama a un endpoint interno con
      la clave interna. Es genérico.
    - `scripts/find-echoed-titles.mjs`: auditoría de sólo lectura, compañera de
      `headline-similarity`. `retitle-echoed-notes.mjs` fue de una vez y se queda
      en fulbo.

**Restos en Nib** (`scripts/check-neutral.sh` no los agarra todos):
`README.md` es el de fulbo ("# fulbo-cms"); `Dockerfile:1,4` dice `codelo-cms`;
`scripts/check-openrouter.mjs` ("football stadium" y el referer de
cogollosdeloeste); `scripts/seed-test-post.mjs:109-129` (tags REPROCANN y
Cáñamo); comentarios en `lib/openai.ts:383`, `lib/prompt-defaults.ts:204` y
`lib/rss-fetcher.ts:480`.

---

## 3. Se queda en la vertical de fulbo (después de las costuras)

- Contenido para las costuras de la sección 2: pools de tapa (5), ejemplos de
  dedup (6), medios rivales y regla de puntajes (7), camisetas de club (9), tag
  por defecto `argentino`.
- **Desorden de propiedad en fulbo** para limpiar en el mismo merge:
  - `apps/cms/.env.example` y `README.md` quedaron con el texto viejo de fulbo;
    al `.env.example` le faltan `PROJECT_SLUG`, `PROJECT_NAME`,
    `INTERNAL_API_KEY`, `PREVIEW_SECRET` y `PREVIEW_WEB_URL`.
  - `admin/pages/ApiFootballSettingsPage/` está en las páginas del motor y va en
    `admin/verticals/`.
  - `lib/rss-fetcher.test.ts` (aserciones de fútbol) y el logo
    `lib/social-cards/assets/logo/fulbostudio.2.png` están en directorios del
    motor. `LOGO_FILE` sólo puede nombrar un archivo de ahí, así que el logo
    necesita que el motor acepte una ruta del vertical.

**Lo que no se toca:** el ingestor, `packages/db`, la web de fútbol, torneos, la
integración con api-football (su `api-football-setting` y su página) y el rol
`analyst` con `match-context`. Todo eso anda.

---

## Orden sugerido

1. **Fulbo baja `upstream/main` + semilla** (sección 1). Es lo único urgente: saca
   los prompts de codelo de producción. Correr los tests de preservación con
   `SETTINGS_FULBO` y comparar las fixtures antes del deploy.
2. **Nib suma las costuras y los arreglos de la sección 2**, con fixtures de
   preservación recapturadas donde el texto cambie a propósito.
3. **Fulbo baja de nuevo y carga su contenido en las costuras nuevas** (sección
   3). Recién ahí vuelve todo lo que tenía antes de adoptar.

Antes de desplegar cualquier merge en fulbo, backup de la base: el CMS migra el
schema al arrancar, y un enum mal resuelto no se deshace sin él.

---

# Addendum de Nib (28-sep): qué se cerró y qué le toca a fulbo

Lo escribió la sesión de Nib después de implementar la sección 2. El texto de
arriba queda como está; esto lo corrige donde quedó viejo y dice cómo seguir.

## Correcciones al texto de arriba

- **§1 "colores de las placas en `verticals/brand.ts`" y §3 "`LOGO_FILE`
  necesita una ruta del vertical": obsoletos.** Desde `ae9bf74` los colores y
  el logo de las placas viven en `site-setting` (Ajustes del sitio → Identidad
  visual) y se cargan por semilla (`siteSettings`) o desde el panel.
  `verticals/brand.ts` quedó con `BRAND_FONTS` y `LOGO_FILE`, que es sólo el
  logo por defecto mientras no se suba uno.
- **"El CHECK de Postgres tira el arranque": no en Strapi 5.54.** No crea CHECK
  para los enums; los valida `strapi.documents()`. Igual hay que conservar
  `analyst`, `team` y `worldcup` en los enums: sin ellos no se puede crear ni
  editar un agente analista por la API de documentos, y el panel no los
  etiqueta.
- **§2.10 `generateCoverAndPublish` no existía.** La copia del pipeline de
  portada está inline en `runAnalyst` (`verticals/analyst.ts`).
- **Restos:** los scripts estaban en `apps/cms/scripts/`, y los comentarios de
  `lib/` ya estaban barridos.

## Qué cerró cada commit de `upstream/main`

| §2 | Commit | Cómo se llama |
| --- | --- | --- |
| 1. Anti-calco del generador | `7dd4ec0` | `newsGenerate` reintenta dos veces y responde `titleWarning: { echoedHeadline } \| null`; `TITLE_ORIGINALITY_RULES` y `echoFeedback` en `lib/headline-similarity.ts`; aviso `nota.aviso.calco` en el editor de notas |
| 2. Ventana de noticias | `abecc69`, `f89e0b0` | `site-setting.ingestWindowDays` (1..90, default 7): una sola ventana para ingesta, podado y pool. El prompt del redactor la nombra (`ingestWindowLabel`: "last 24h" con 1 día, "last N days" si no) |
| 3. Filtro de relevancia | `7dd4ec0` | `selectFreePool` en `lib/rss-fetcher.ts`: filtra por `rss-scope` y, si no queda nada, usa el pool entero con un warning |
| 4. Sufijo de imagen | `7dd4ec0` | "ONE single unified image"; y "collage of separate pictures" en vez de "collage", que le pegaba al tratamiento de collage |
| 5. Pools de tapa | `bb50022` | Costura `verticals/cover-pools.ts` (`verticalCoverPools: Partial<CoverPools>`); tipos y `ENGINE_POOLS` en `lib/cover-pools.ts` |
| 6. Ejemplos del dedup | `f89e0b0` | `prompt-setting.dedupExamples` (dos líneas) |
| 7. Reglas extra del Director | `f89e0b0` | `prompt-setting.brandGuardrails`: viñetas completas (`  - …`) que entran en el STEP 2.5, después de las cuatro del motor |
| 8. Tablero por rol | `bb50022` | Una sección de Agentes por cada `agentRoles` de `admin/verticals.ts`, con editar, borrar, correr y activar |
| 9. Anclas | `bb50022` | Costura `verticals/anchor-enrichers.ts`: `(anchors) => { lines?, drop? } \| null` |
| 10. Helpers | `2aa071a` | `generateCoverForPost` (`lib/cover-pipeline.ts`), `ensureTagBySlug` (`lib/tags.ts`), `triggerInternalJob` (`lib/internal-jobs.ts`), `scripts/find-echoed-titles.mjs` |
| 10. Tag por defecto | `f89e0b0` | `site-setting.defaultPostTagSlug` |
| Restos | `6688436` | README, Dockerfile y scripts neutros; `check-neutral.sh` los escanea |

`generateCoverForPost` **no persiste ni audita**: devuelve
`{ coverImageId, coverPrompt }` y cada caller guarda la nota y registra
`cover_generated` después de guardar, como antes. Si falla lanza
`CoverPipelineError`, con `.prompt` = el último prompt elegido.

## Parte 3 — lo que tiene que hacer fulbo

`upstream/main` trae, además de lo de arriba, los 18 commits posteriores a
`663dc5e7`: la paleta neutra del panel (`b5f5d06`), colores y logo de las
placas a la base (`ae9bf74`), OpenAI SDK 7 (`3d78404`) y su consumo en Ajustes
(`e36e17c`), Strapi 5.54 con el design system pineado (`4eb9ba1`), el panel en
castellano e inglés (`784c948`, `34bf817`, `ce51d32`), el rol explorador
(`abecc69`) y los grupos de la sección 2.

### 0. Antes de tocar nada, en el VPS

- `git -C /opt/fulbo status --short`: un `docker-compose.prod.yml` editado a mano
  en el server ya bloqueó los deploys una vez sin aviso.
- El pipeline **no hace backup** y el CMS migra el schema al arrancar: correr
  `scripts/backup-postgres.sh` a mano justo antes del deploy. Desde `6688436`
  el script toma el slug del `.env` de `/opt/fulbo`; si fulbo conserva una copia
  propia, verificar que siga apuntando a `fulbo-postgres`.

### 1. Merge

`git fetch upstream && git merge upstream/main`. Conflictos esperados, todos de
clase B (quedarse con los dos lados):

- `api/agent/.../schema.json`: conservar `analyst`, llega `explorador`.
- `api/agent-action/.../schema.json`: conservar `analyst`; llegan `explorador`
  y la acción `explorador_idle`.
- `api/tag/.../schema.json`: conservar `topic|event|team|worldcup`.
- `api/post/.../schema.json`: conservar `sourceMatchId`; llega `researchNotes`.
- `api/prompt-setting/.../schema.json`: conservar `analyst*`; llegan
  `dedupExamples` y `brandGuardrails`.
- `api/site-setting/.../schema.json`: llegan `brand*`, `brandLogo`,
  `ingestWindowDays` y `defaultPostTagSlug`.
- `apps/cms/package.json` y `pnpm-lock.yaml`: la versión de Nib más lo propio,
  y `pnpm install`.

Lo de clase A va con la versión de Nib. Después: `pnpm exec strapi
ts:generate-types`.

### 2. El contenido de fulbo en las costuras (`apps/cms/src/verticals/`)

Los textos salen de `47e1054e`:

- **`cover-pools.ts`**:
  - `compositions`: las 8 de `lib/openai.ts:102-111`.
  - `moods`: los 9 de `:113-124`, con "stadium floodlights at night" y
    "neon-accent lighting".
  - `treatments`: los 10 `STYLES` de `:133-161` como `{ kind, value }`, con
    `photo` → `"photo"` e `illustration` → `"art"`.
  - `artRenders` puede quedar la del motor.
  - ⚠️ Cinco estilos fotográficos nombran marcas y personas ("Sports
    Illustrated", "National Geographic", "Magnum", "Annie Leibovitz", "FIFA
    museum"), y el modelo de imagen tiende a escribir los nombres en la
    imagen. Conviene describir el estilo sin el nombre.
- **`anchor-enrichers.ts`**: `CLUB_MARKS`, `CLUB_MARK_HOMONYMS` y
  `resolveTeamMark` (`:257-313`), y un enriquecedor:
  ```ts
  (a) => {
    const mark = resolveTeamMark(a.country ?? null);
    return mark
      ? {
          lines: [`- Team visual signature — work this KIT PATTERN into the scene (on a plain unbranded shirt, a scarf, a flag, a painted wall, a banner): ${mark}. Never a crest or badge.`],
          drop: ["teamColors"],
        }
      : null;
  }
  ```
  La línea va al final de MUST FEATURE (antes iba después de `country`).
- **`brand.ts`**: la forma nueva, sólo `BRAND_FONTS` (Anton / Inter) y
  `LOGO_FILE = "nib.png"`. Borrar `lib/social-cards/assets/logo/fulbostudio.2.png`
  (es un directorio del motor): el logo se sube desde el panel (paso 6).
- **`cron.ts`**: el `triggerIngestorJob` local pasa a
  `triggerInternalJob(strapi, { baseUrl: process.env.INGESTOR_URL, apiKey: process.env.INTERNAL_API_KEY, job })`.
- **`post-tags.ts`**: `ensureScopeTag(strapi, key)` pasa a
  `(await ensureTagBySlug(strapi, SCOPE_TAGS[key])).documentId`. `SCOPE_TAGS` y
  `classifyMatchScope` se quedan.
- **`analyst.ts`**: la copia del pipeline (`runAnalyst`, ~236-311) pasa a
  `generateCoverForPost(strapi, { documentId, title, excerpt }, { textClient, textModel, imageModel, keys, imgAgent, promptSettings, logTag: "[analyst]" })`,
  dentro del mismo `try/catch` con su `cover_failed`. El update + publish y el
  `cover_generated` quedan como están.
- **`seed.ts`**: una semilla **nueva, con otra clave**, porque la aplicada no
  vuelve a correr:
  ```ts
  {
    key: "fulbo-editorial-2026-10",
    promptSettings: {
      dedupExamples: SETTINGS_FULBO.dedupExamples,
      brandGuardrails: SETTINGS_FULBO.brandGuardrails,
    },
    siteSettings: {
      defaultPostTagSlug: "futbol-argentino",
      brandBg: "#0C110F", brandTitle: "#FFFFFF", brandBody: "#E9ECEA",
      brandMuted: "#8B938F", brandAccent: "#FF7A00",
      brandAccentLight: /* decidir, ver abajo */, brandAccentDeep: "#E5392F",
    },
  }
  ```
  Los dos textos ya están en `test/preservation/settings.fulbo.ts` de Nib: son
  las dos líneas de `47e1054e:lib/openai.ts:395-396` y las viñetas de
  `:849-850`.

  **`brandAccentLight` es una decisión.** El motor no tiene `accentWarm`, y el
  degradé va `accentLight → accent → accentDeep`.
  - `#FFB02E` reproduce la estela ámbar → naranja → rojo, pero pinta de ámbar
    las volantas, las comillas y la url.
  - `#FF7A00` las deja en naranja y pierde el ámbar del degradé.

  Elegir mirando la vista previa de Identidad visual.

  `ingestWindowDays` **no se puede sembrar**: tiene default 7 en el schema, así
  que nunca está vacío. Si fulbo quiere 1 día ("last 24h"), va en el panel.
- **`test/seed.fulbo.test.ts`**: la unión de los `promptSettings` de todas las
  semillas tiene que dar `toEqual(SETTINGS_FULBO)`. Rompe apenas entra el merge,
  porque llegan dos claves nuevas, y lo arregla la semilla nueva.

### 3. Propiedad de archivos, en el mismo merge

- `admin/pages/ApiFootballSettingsPage/` → `admin/verticals/`, ajustando
  `menuLinks`/`routes` en `admin/verticals.ts`.
- `lib/rss-fetcher.test.ts`, con aserciones de fútbol → `verticals/rss-scope.fulbo.test.ts`.
- `apps/cms/.env.example`: sumar `PROJECT_SLUG`, `PROJECT_NAME`,
  `INTERNAL_API_KEY`, `INGESTOR_URL`, `PREVIEW_SECRET` y `PREVIEW_WEB_URL`.
- `apps/cms/README.md` propio: el de Nib ya no dice "fulbo".

### 4. Verificación local

- `pnpm typecheck && pnpm test`: la preservación con `SETTINGS_FULBO` y
  `seed.fulbo.test.ts`.
- `./scripts/check-neutral.sh` (la copia de fulbo excluye las costuras).
- El build de la imagen del CMS, que es lo único que compila el panel.
- Arrancar contra una copia de la base de prod. El log tiene que mostrar
  `[seed] fulbo-editorial-2026-10 aplicada. promptSettings: sembrados=[dedupExamples, brandGuardrails] …`
  y, en `siteSettings`, los colores y `defaultPostTagSlug` sembrados. Si aparece
  `IGNORADOS(no están en el schema)`, falta un atributo en un `schema.json`.

### 5. Deploy

Paso 0 (status y backup) → Jenkins → el log de arranque como en el paso 4, sin
`PROJECT_SLUG no está configurada`.

### 6. Después del deploy

- **Configuración editorial:** "Ejemplos del deduplicador" y "Reglas extra del
  Director" con el texto de fulbo, y la tarjeta del analista.
- **Ajustes del sitio:** los colores y la etiqueta por defecto. **Subir el logo
  ahí mismo**: hasta entonces las placas imprimen el de Nib.
- **Agentes:** una sección para los analistas, con editar, borrar y correr.
- **Auditoría:** etiqueta `analyst` y `explorador`.
- **Correr ahora** en un redactor (el log dice "last N days") y en el analista
  (auditoría `cover_generated` con `trigger: "analyst"`).
- **Social Studio:** una placa con los colores y el logo correctos.
- **Editor de notas:** generar con búsqueda web (aviso si el título calca), y
  guardar sin etiquetas: tiene que salir con `futbol-argentino`.

## Nota para codelo

El neutro de `dedupExamples` no es el texto que codelo usa hoy: esas dos líneas
son las suyas, y estaban escritas en el motor. Para que el deduplicador no le
cambie al mergear, codelo las carga en su semilla (el valor está en
`test/preservation/settings.codelo.ts`). Lo mismo que fulbo: una semilla nueva,
con otra clave.
