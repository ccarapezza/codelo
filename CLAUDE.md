# codelo (Cogollos del Oeste) — guía para agentes

Portal de información de **Cogollos del Oeste**, asociación civil sin fines de
lucro (oeste de CABA). Monorepo pnpm hermano de fulbo/x100, pero **sin APIs externas
de datos y sin Prisma**: todo el contenido (posts, páginas, eventos) vive en
Strapi y la web lo consume por REST.

## Arquitectura

| Pieza | Qué es | Puerto dev |
| --- | --- | --- |
| `apps/codelo-cms` | Strapi 5: posts + pages + events + tags + motor de agentes IA + settings | 1339 |
| `apps/codelo-web` | Next.js 16 (App Router, next-intl **ES-only**, shadcn sin estilo) | 3200 |
| Postgres / Redis | `docker-compose.dev.yml` | 5435 / 6381 |

**Los puertos dev están corridos a propósito** para convivir con fulbo
(5432/1337/3000), pingpong (5433) y x100 (5434/1338/3100). No los "normalices".

No hay `packages/db` ni ingestor: la web NO toca Postgres. Su health check
(`/api/health`) reporta la reachability del CMS, no de una DB.

## Levantar todo desde cero

```bash
pnpm install
docker compose -f docker-compose.dev.yml up -d     # postgres :5435, redis :6381

cp .env.example .env                                # raíz (OpenAI keys, CORS…)
cp apps/codelo-cms/.env.example apps/codelo-cms/.env   # generar secrets: openssl rand -base64 32
cp apps/codelo-web/.env.example apps/codelo-web/.env   # NEXT_PUBLIC_CMS_URL=http://localhost:1339

pnpm dev:cms    # Strapi en http://localhost:1339 (primer boot compila el admin, ~1 min)
pnpm dev:web    # Next en http://localhost:3200
```

### Primer arranque del CMS

1. `http://localhost:1339/admin` → crear el primer usuario admin.
2. Cargar contenido inicial (o via REST con un API token full-access):
   - **Pages** con slugs exactos `quienes-somos`, `reprocann`, `contacto` — la
     web mapea rutas fijas a esos slugs; si faltan, la página muestra un
     placeholder "sin contenido" (no rompe).
   - **Events** para `/actividades` (startsAt obligatorio; se separan en
     próximas/pasadas automáticamente).
   - **Posts** (locale `es`) para el blog.
3. Para los agentes IA: configurar fuentes RSS y agentes desde el admin
   (menú Agentes IA / Fuentes RSS); necesitan `OPENAI_API_KEY` en el env del CMS.

## Modelo de contenido

- `post` — blog (i18n habilitado; el sitio usa solo `es`). Generado por agentes
  IA o manual.
- `page` — páginas estáticas por slug (title, slug, content markdown,
  seoDescription, coverImage). Rutas web fijas → slugs conocidos.
- `event` — agenda del sector (title, slug, startsAt, endsAt?, place?,
  **organizer?**, **sourceUrl?**, description markdown, coverImage). Son eventos
  de TERCEROS: ver "Agenda" más abajo. `/actividades` y la home los leen vía
  `apps/codelo-web/lib/content.ts`.
- `tag.kind` ∈ `topic | event` (el type espejo está en `lib/cms.ts`).
- `agent` tiene `requireNewsContext`: si está activo y no hay noticias que
  matcheen su topic, el redactor NO escribe (evita el "modo análisis", que
  redacta de memoria del modelo e inventa datos).
- Motor IA: `agent`, `agent-action`, `news-context`, `rss-feed`,
  `prompt-setting` (overrides de los defaults en `src/lib/prompt-defaults.ts`),
  `site-setting`, `house-ad`, `social-studio`.
- Roles de agente: `director | redactor | image-generator`. (Existía un rol
  `analyst` heredado de la plantilla de fulbo —analizaba partidos de fútbol—
  eliminado junto con `match-context.ts` y `post.sourceMatchId`.)

## Consulta INASE — cultivares, operadores y rótulos

`/semillas` espeja dos registros públicos de INASE para que obtentores,
productores y cultivadores puedan verificar qué compran. Módulos en
`src/lib/inase/`, crons `inaseCultivares` (semanal) e `inaseOperadores` (cada 2
días), y sync manual por `POST /api/inase/sync-{cultivares,operadores}` con
`x-internal-key`.

⚠️ **Las dos fuentes son APIs internas no documentadas**, igual que el Boletín
Oficial: fallo suave, nunca vacían el espejo. Los gotchas verificados —cada uno
costó un bug o casi— están comentados en el código, pero los cuatro que más
duelen:

- **`length` tiene tope 100 y falla en SILENCIO.** Con 200 devuelve HTTP 200,
  `iTotalRecords: null` y `aaData: []`. Una página vacía es indistinguible de
  "se terminaron los datos": sin validar el conteo, un cambio de INASE espeja
  cero filas sobre un catálogo bueno. `fetchAllRows()` valida cada página.
- **El TSV del padrón trae BOM UTF-8 con cuerpo latin1.** Decodificado como
  latin1 —que es lo correcto— el BOM llega como los tres caracteres `ï»¿`, NO
  como `﻿`. Strippear sólo `﻿` *parece* bien, pasa los tests con un
  fixture escrito a mano, y rompe contra el archivo real. Lo cazó el test en
  vivo, no el unitario.
- **Las categorías del `numeroInscripcion` son códigos COMPUESTOS**
  (`J1 J2 K1 K2` además de `A`–`I`, `N`–`P`). `5667HK2O` es H + K2 + O.
  Tokenizar carácter por carácter inventa categorías y pierde reales.
- **El filtro `searchBuilder` no anda por GET** (da 0 hasta para `MAIZ`), así que
  hay que paginar las ~149 páginas y filtrar local por
  `condicion_genetica === "COMERCIALIZACIÓN: LEY 27350 Y LEY 27669"` — más
  estable que por `especie`, que se escribe `CANNABIS` o `CAÑAMO` según la fila.

**El obtentor no es el identificador.** El `solicitante_rnc` del catálogo
registró la genética; el N° RNCyFS del rótulo es de quien fracciona y rotula.
Son dos entidades en dos registros y INASE no publica clave entre ellos: el
cruce se hace por nombre normalizado y **sólo se muestra con coincidencia
única**, porque elegir entre dos sería inventar un vínculo que el Estado no
afirma.

**Reglas que no se relajan:**

- **La columna `email` del padrón NO se persiste.** Son ~3.000 direcciones en
  claro; republicarlas regala una lista de spam sin que la asociación gane nada.
  Se descarta en el parser, no en la vista.
- **"No encontrado" ≠ "no habilitado".** Un número puede faltar por baja
  posterior, rótulo viejo, error de lectura o el desfasaje de 48 h del padrón.
  La UI dice *"no figura en el padrón vigente"* y nunca interpreta. Afirmar que
  un vendedor con nombre propio es irregular, a partir del OCR de una foto, es
  difamatorio si está mal.
- **Las categorías se traducen SÓLO con la leyenda oficial.** Está en
  `apps/codelo-web/lib/categorias-rncyfs.ts`, tomada del PDF de INASE
  (`docs/inase/`, con copia versionada porque la URL lleva `v09-24` y rota) y
  respaldada por la **Res. INASE 474/2024, Anexo I**. Un código desconocido se
  renderiza crudo, nunca con el significado de un vecino. Y la UI aclara que
  **la categoría describe la actividad, no la especie**: el padrón no publica
  para qué especies está inscripto cada operador, así que tener `F` no equivale
  a estar habilitado para cannabis. (Res. 653/2023 habilitó A, B, E, F, H y K
  para *Cannabis sativa* L.)
- **La serie de la estampilla identifica, no valida.** El DataMatrix contiene
  sólo `01CAA` + 9 dígitos (verificado decodificando un paquete real): sin URL y
  sin campos extra. No hay endpoint público donde contrastarla —la validación
  vive únicamente dentro de la app móvil de INASE—, así que la UI nunca la
  presenta como comprobante. Lo verificable es el texto impreso: cultivar y
  N° RNCyFS.

**El matching de cultivar es difuso a propósito.** Los rótulos están impresos en
vertical sobre papel curvo: `CRAIG` se lee `CRAI1` con facilidad. Un match
exacto respondería "no está registrado" para una variedad que sí lo está, que es
la peor respuesta posible acá porque es sobre la que alguien podría actuar.

Tests: `src/lib/inase/*.test.ts`. Los de red están en `live.test.ts` y sólo
corren con `INASE_LIVE=1` — ahí viven las aserciones que distinguen "INASE
cambió algo" de "lo rompimos nosotros". Ojo: crear archivos dentro de
`apps/codelo-cms/src/` reinicia el dev server y corta un sync en curso.

## Vigilancia normativa — Boletín Oficial

`src/lib/boletin-oficial.ts` alimenta `news-context` con normas nuevas
(cannabis, cáñamo, estupefacientes) para que el Redactor escriba sobre cambios
regulatorios con la norma como fuente. Corre por cron a las 07:15 (ventana de
7 días, ver `config/cron-tasks.ts`).

⚠️ **Es una API interna, no oficial.** El BO no publica RSS ni API documentada;
el módulo habla con `/busquedaAvanzada/realizarBusqueda`, el endpoint que usa su
propio buscador. No está versionado y puede romperse sin aviso — por eso todo
falla suave (loguea y sigue). Los feeds RSS son la fuente primaria; esto
complementa. Tres cosas no obvias, todas verificadas contra el sitio real:

- **El rango de fechas va sí o sí.** Los resultados vienen agrupados por rubro
  (LEYES, DECRETOS…) y **no** por fecha, paginados: sin `fechaDesde`/`fechaHasta`
  una búsqueda de "cannabis" trae ~290 hits desde 1999 y una norma de ayer puede
  quedar en la página 3.
- **La búsqueda multi-palabra es OR.** "reducción de daños" devuelve ~100
  decretos que solo comparten el "de". Por eso `itemMatchesTerm()` exige que
  *todas* las palabras significativas aparezcan en el ítem.
- **Cero resultados llega como `error: 0` con `html` vacío** — no es un fallo
  (REPROCANN, por ejemplo, nunca aparece literal en el Boletín).

## Reglas editoriales del vertical (prompts)

`src/lib/prompt-defaults.ts` define el dominio con reglas duras que NO deben
relajarse. El temario sale de los **objetos estatutarios (Art. 1)**: etnobotánica
de plantas (Plantae) y hongos (Fungi) con énfasis en Cannabis y cáñamo/hemp;
DDHH (derecho a la salud, soberanía alimentaria) y reducción de daños; ambiente.
REPROCANN y autocultivo entran como asesoramiento dentro de ese marco, no como
eje único.

Reglas duras: la cláusula literal del **Art. 2-C** — *"En ningún caso… comprenderán
el fomento del consumo de sustancia alguna, lícita o no"* —, sin consejo médico ni
dosis, sin apología ni contenido para menores, y las imágenes nunca muestran
consumo, caras ni marcas. Los hechos no-inventables incluyen requisitos legales y
plazos de REPROCANN; los preprints se citan siempre como tales.

**Reconocimiento entre pares.** Cuando un par de la sociedad civil (fundación,
cooperativa, asociación) CONSIGUE algo —un registro, una licencia, un fallo— la
nota lo felicita desde la voz de la asociación (Art. 2-D). NO aplica a organismos
del Estado: que ANMAT emita una disposición no es un logro. El Director tiene la
regla espejo para no leerlo como publicidad. Calibrarla costó tres iteraciones y
solo funcionó al incluir un ejemplo textual del párrafo esperado — si se toca,
re-probarla corriéndola. Ver `docs/agentes.md`.

**La industria SÍ se cubre.** Ley 27.669, ARICCAME, Expo Cannabis y el desarrollo
agroindustrial/alimentario del cáñamo son objeto estatutario (Art. 1-A) y tema
legítimo. La línea roja no es hablar de la industria sino **ser canal de venta**:
no se publicitan ni recomiendan productos, marcas o comercios al lector.

## ⚠️ `run-batch` NO filtra por tema — usar `run-now`

`planBatch()` arma el pool con `getRecentNewsForTopic(strapi, "", 200)`: el topic
vacío es deliberado, reparte lo que haya entre los redactores. Eso venía de una
plantilla donde TODOS los feeds eran del mismo vertical, así que cualquier ítem
servía. Acá **no**: los feeds `[AR]` (Infobae, Clarín, La Nación, Perfil) son de
noticias generales y dominan el pool por volumen.

Correrlo así produjo 26 borradores sobre Messi, Matt Damon, la cotización del
euro y el Día Mundial del Perro — uno por cada slot pedido, ninguno del tema. No
falla ni avisa: el redactor escribe con diligencia sobre lo que le toca.

Para generar contenido usar **`/api/agent/run-now`** (o los schedules), que sí
filtra por `agent.topic`. `run-batch` solo sirve si antes se apagan los feeds
generalistas.

## Portadas: el tratamiento visual rota, no es siempre foto

`TREATMENTS` en `src/lib/openai.ts` es la dimensión que evita que todas las
portadas se parezcan: 12 tratamientos (4 fotográficos, 8 dibujados/impresos —
lámina botánica, risografía, linograbado, diagrama, collage, aguada…) que
`resolvePromptConstraints()` elige por hash del `seedKey`. El **medio** manda: las
THEME → SCENE CUES dicen QUÉ mostrar, el tratamiento dice CÓMO renderizarlo.

Tres cosas que hay que respetar si se toca:

- **El fotorrealismo estaba afirmado en tres capas a la vez** (instrucciones del
  sistema, user prompt y un pool de estilos 100% fotográfico). Alcanzaba con que
  sobreviviera una para que todo volviera a salir foto. Si reaparece la monotonía,
  buscar `photorealistic` en los tres lugares antes que culpar al modelo.
- **El pool de mood sigue al tratamiento**: iluminación (`MOODS`) para fotos,
  tinta y paleta (`ART_RENDERS`) para ilustraciones. Pedirle "golden hour con
  sombras largas" a un linograbado produce un híbrido confuso.
- **La regla anti-diptych es de MAQUETACIÓN, no de medio.** Prohíbe paneles,
  grillas y before/after; un tratamiento *collage* es válido mientras arme una
  sola escena continua. Antes decía "NEVER a … collage" y contradecía al pool.

⚠️ **`ArticleAnchors` y `IMAGE_ANCHOR_TAXONOMY` tienen que estar sincronizados.**
La taxonomía (editable desde el admin) le dice al modelo qué devolver; la interfaz
y el parser deciden qué se conserva. Se desincronizaron una vez: la taxonomía ya
pedía `topic`/`palette`/`season` mientras el parser seguía leyendo los campos de
fútbol `teamColors`/`jerseyNumber`, así que 3 de 5 anchors se descartaban en
silencio y la paleta por artículo nunca llegaba al prompt. Falla sin error.

## Diseño de la web — dirección "Dos Tintas"

La paleta se **muestreó del logo real** (`apps/codelo-web/public/icons/logo.png`),
no se eligió de un catálogo: tinta azul-negra `#00001C` (el "negro" del logo NO
es neutro), sol ámbar `#E4B569`, papel `#F6E6CC`. Tipografía en cuatro roles:
Big Shoulders **solo** para el nombre de la asociación, Zilla Slab en titulares,
Literata en cuerpo, IBM Plex Mono en etiquetas.

La firma son las **portadas en duotono parcial** (`.duotone` en `globals.css`).
Detalle no obvio: usa `--brand-ink`/`--brand-sun`, constantes que **NO se
invierten con el tema**. Con los tokens normales, en modo oscuro la imagen
quedaba en `screen` sobre fondo claro y el velo ámbar la tapaba.

Spec completa, incluidas las razones de cada decisión y los anti-patrones:
`apps/codelo-web/design-system/codelo-—-cogollos-del-oeste/MASTER.md`.

## Agenda: eventos de terceros

La asociación **no organiza actividades propias**. `/actividades` es una agenda
de eventos del sector (Expo Cannabis, etc.) organizados por otros. Por eso
`event` tiene `organizer` y `sourceUrl`: sin la atribución visible el portal se
atribuiría eventos ajenos. La copy evita cualquier "nuestras actividades".

## Verificación

```bash
pnpm typecheck                          # ambas apps
pnpm --filter codelo-web build          # build de producción
curl localhost:3200/api/health          # {"status":"ok","cms":"ok"}
curl localhost:1339/_health             # 204
curl "localhost:1339/api/posts?locale=es"
curl "localhost:1339/api/pages" ; curl "localhost:1339/api/events"
```

Gotchas:
- Si el blog o las páginas aparecen vacíos sin error: falta
  `NEXT_PUBLIC_CMS_URL` en `apps/codelo-web/.env` (los fetchers fail-soft
  devuelven vacío/null en silencio).
- Tras tocar content-types del CMS: `cd apps/codelo-cms && pnpm exec strapi
  ts:generate-types` (los generados están gitignoreados).
- **`ENOSPC` / dev servers que se caen solos**: VS Code agota los watchers de
  inotify vigilando `node_modules` y `dist` (llegó a 63.000 de 65.536). Hay un
  `files.watcherExclude` en `.vscode/settings.json`; si aparece igual, revisar
  con `cat /proc/sys/fs/inotify/max_user_watches` y recargar las ventanas.
- ES-only: `i18n/routing.ts` tiene `locales: ["es"]`. Para sumar un idioma se
  extiende ese array + se agrega `messages/<locale>.json`.

## Convenciones y decisiones

- **Branding**: `SITE_NAME`/`SITE_URL` viven SOLO en `apps/codelo-web/lib/site.ts`
  (+ env `NEXT_PUBLIC_SITE_URL`). Dominio real: `cogollosdeloeste.com.ar`
  (fijado por el Estatuto, Art. 2-B); el CMS va en `cms.cogollosdeloeste.com.ar`.
- **Restos de fulbo: barrer en inglés, no solo en español.** La plantilla venía
  de un sitio de fútbol y el grueso del residuo estaba en los prompts, que están
  escritos en inglés. Un `grep -i "fulbo|futbol|mundial"` da limpio y aun así
  quedaban `"football (soccer) news site"` en el traductor, `"La Bombonera"` como
  ejemplo de nombre propio y un pool de estilos con `FIFA` y `Sports Illustrated`.
  Barrer con: `football|soccer|jersey|squad|stadium|world cup|fifa|penalty`.

## Deploy (referencia)

Mismo VPS que fulbo/x100, detrás del Caddy compartido de `/opt/proxy` (red
externa `proxy-edge`; nada publica puertos al host). `docker-compose.prod.yml`
con containers `codelo-*` y red `codelo-internal`; **sin servicio migrate**
(Strapi gestiona su schema en el boot). Pipeline: `Jenkinsfile` (shared lib
`westcode-shared`, `remoteDir /opt/codelo`, secrets Jenkins `codelo-*`).
