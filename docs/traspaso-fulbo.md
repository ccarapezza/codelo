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
