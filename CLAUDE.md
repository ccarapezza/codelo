# codelo (Cogollos del Oeste) — guía para agentes

Portal de información de la agrupación cannábica **Cogollos del Oeste**
(oeste del GBA). Monorepo pnpm hermano de fulbo/x100, pero **sin APIs externas
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
- `event` — actividades (title, slug, startsAt, endsAt?, place?, description
  markdown, coverImage). `/actividades` y la home las leen vía
  `apps/codelo-web/lib/content.ts`.
- `tag.kind` ∈ `topic | event` (el type espejo está en `lib/cms.ts`).
- Motor IA: `agent`, `agent-action`, `news-context`, `rss-feed`,
  `prompt-setting` (overrides de los defaults en `src/lib/prompt-defaults.ts`),
  `site-setting`, `house-ad`, `social-studio`.

## Reglas editoriales del vertical (prompts)

`src/lib/prompt-defaults.ts` define el dominio cannábico con reglas duras que
NO deben relajarse: sin consejo médico ni dosis, sin promoción de venta
(el marco es autocultivo + cultivo solidario + REPROCANN), sin apología ni
contenido para menores, y las imágenes nunca muestran consumo, caras ni marcas.
Los hechos no-inventables incluyen requisitos legales y plazos de REPROCANN.

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
- ES-only: `i18n/routing.ts` tiene `locales: ["es"]`. Para sumar un idioma se
  extiende ese array + se agrega `messages/<locale>.json`.

## Convenciones y decisiones

- **Branding**: `SITE_NAME`/`SITE_URL` viven SOLO en `apps/codelo-web/lib/site.ts`
  (+ env `NEXT_PUBLIC_SITE_URL`). Dominio real TBD (placeholder
  `cogollosdeloeste.example`). La web usa shadcn default sin estilo a propósito.
- Deuda conocida heredada de la plantilla: las social cards del CMS
  (`src/lib/social-cards/`) aún usan el logo de fulbo; `post.sourceMatchId`
  conserva ese nombre; `match-context.ts` existe pero ningún agente "analyst"
  lo usa en este vertical.

## Deploy (referencia)

Mismo VPS que fulbo/x100, detrás del Caddy compartido de `/opt/proxy` (red
externa `proxy-edge`; nada publica puertos al host). `docker-compose.prod.yml`
con containers `codelo-*` y red `codelo-internal`; **sin servicio migrate**
(Strapi gestiona su schema en el boot). Pipeline: `Jenkinsfile` (shared lib
`westcode-shared`, `remoteDir /opt/codelo`, secrets Jenkins `codelo-*`).
