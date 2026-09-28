# @nib/cms

El CMS de Nib: Strapi 5 con los agentes de redacción, las portadas IA, la
ingesta de RSS, Social Studio y el gestor de notas. La web (`apps/web`) lo
consume por REST; no toca la base.

Es el motor sin ningún vertical. Un proyecto que lo adopta le suma lo suyo por
las costuras (`src/verticals/`, `src/admin/verticals.ts`) y carga su texto
editorial en la base; ver `docs/adoptar-nib.md` en la raíz del repo.

---

## Levantarlo

**Instancia completa en Docker** (CMS + web + Postgres + Redis), lo más rápido
para mirar el panel:

```sh
./scripts/local-up.sh      # desde la raíz del repo
```

Panel en `http://localhost:1340/admin` (la primera vez pide crear el usuario
admin). Los agentes necesitan `OPENAI_API_KEY` en `.env.local`; sin ella el resto
del panel funciona igual.

**Modo desarrollo**, con recarga en caliente:

```sh
docker compose -f docker-compose.dev.yml up -d   # Postgres :5436, Redis :6382
cp apps/cms/.env.example apps/cms/.env           # secretos: openssl rand -base64 32
pnpm dev:cms                                     # http://localhost:1340
```

Los puertos están corridos a propósito para convivir con los proyectos que usan
el motor. No los "normalices".

---

## Tests

```sh
pnpm test                  # desde la raíz, o `pnpm exec vitest --run` acá
pnpm typecheck
../../scripts/check-neutral.sh   # el motor no nombra ningún tema
```

- `test/preservation/` congela, byte a byte, los prompts que arma el motor con
  los ajustes reales de los proyectos que lo adoptan. Si un cambio a un prompt
  es deliberado, se recaptura con
  `CAPTURE=1 pnpm exec vitest --run test/preservation/capture.test.ts` y lo que
  se revisa es el diff de los fixtures.
- `tsconfig` excluye `src/admin/`: el panel sólo se compila en el build de la
  imagen (`docker build -f apps/cms/Dockerfile .` desde la raíz). Un cambio al
  panel no está verificado hasta que ese build pasa.
- Tras tocar un `schema.json`: `pnpm exec strapi ts:generate-types` (los tipos
  generados están gitignoreados).

---

## Scripts manuales

En `scripts/`, fuera del arranque:

- `check-openrouter.mjs` — prueba de humo del camino de imágenes por
  OpenRouter, sin Strapi. `OPENROUTER_API_KEY=… node scripts/check-openrouter.mjs [modelo]`.
- `seed-test-post.mjs` — dos notas de prueba con etiquetas y (con
  `OPENAI_API_KEY`) portada, para revisar maquetación. Idempotente. Borralas
  antes de producción.

---

## Social Studio (generación IA para Instagram)

Página del admin (`/social-studio`) que genera **portadas, carruseles, historias
y reels** desde una nota o un prompt propio, con plan de costos antes de ejecutar
y preview editable (re-render satori sin volver a llamar IA). Los fondos IA
(imágenes y clips) quedan en la carpeta **AI Backgrounds** del Media Library
para reusarlos gratis.

Requisitos:

- `OPENAI_API_KEY` (texto/imágenes OpenAI) y `OPENROUTER_API_KEY` (imágenes
  Nano Banana + video Veo/Kling/etc. — mismo key que las covers).
- **ffmpeg** para el formato Reel: en producción lo instala el Dockerfile
  (`apk add ffmpeg`); en local instalalo con `apt/brew install ffmpeg` o
  apuntá `FFMPEG_PATH` al binario. Sin ffmpeg, el Studio deshabilita Reel
  (el resto funciona igual).

> Nota: NO usar `ffmpeg-static` — sus binarios son glibc y no corren en el
> runtime alpine (musl).
