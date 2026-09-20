# Nib — guía para agentes

Motor de redacción asistida por IA sobre Strapi 5 + Next.js 16. **Este repo es
el producto, sin ningún vertical.** Los proyectos lo agregan como `upstream` y
le suman lo suyo por las costuras; ver `docs/adoptar-nib.md`, que es la
referencia de qué archivo es de quién.

| Pieza | Qué es | Puerto dev |
| --- | --- | --- |
| `apps/cms` | Strapi 5: agentes, portadas, RSS, Social Studio, gestor de notas | 1340 |
| `apps/web` | Next.js 16 (App Router, next-intl, shadcn) sin diseño propio | 3400 |
| Postgres / Redis | `docker-compose.dev.yml` | 5436 / 6382 |

Los puertos están corridos a propósito para convivir con los proyectos que usan
el motor (codelo 5435/1339/3200, fulbo 5432/1337/3000). No los "normalices".

## La regla que ordena todo

Si un archivo nombra un tema, una marca o un dominio concreto, **está en el
lugar equivocado**. El motor no sabe de qué habla el sitio que lo usa. Antes de
cerrar un cambio:

```sh
grep -rniE "cannabis|futbol|<la marca del momento>" apps/*/src apps/web/{app,components,lib}
```

Lo específico vive en las costuras (`src/verticals/`, `admin/verticals.ts`,
`components/vertical/`, `lib/site.ts`, `theme.css`), todas con default vacío.

## Cómo se separa el trabajo

**Prompts.** `lib/prompt-defaults.ts` define la ESTRUCTURA y unos valores
neutros que sólo sirven para probar el circuito. El tema real lo pone el
proyecto en `verticals/prompt-defaults.ts`, y el admin lo pisa desde la
pantalla de Prompts IA sin tocar código.

**Agentes.** Tres roles en el motor: redactor, director, image-generator. El
runner despacha por nombre y busca en `verticals/agent-roles.ts` lo que no
reconoce. Un rol nuevo va en TRES lugares: el runner, la etiqueta del panel
(`admin/verticals.ts`) y el enum de los `schema.json` de `agent` y
`agent-action` — Postgres respalda el enum con un CHECK.

**Crons.** `config/cron-tasks.ts` tiene los dos del motor (agentes y RSS) y
spreadea `verticals/cron.ts`. Agregar una tarea propia no toca el archivo del
motor.

**Web.** `globals.css` es el puente de tokens; `theme.css` los valores;
`vertical.css` lo que no existe en un portal cualquiera. Los componentes usan
siempre los mismos nombres de token, así que cambiar la identidad visual es
reescribir `theme.css` y nada más. Cuatro ranuras opcionales en
`components/vertical/index.ts`: LayoutExtras, FooterArt, CoverFallback y
PageDecoration.

## Lo que muerde

**`PROJECT_SLUG` no tiene default en producción.** Con ella se arman las claves
del core store, y una de esas claves es lo único que impide que la migración de
i18n vuelva a correr y re-estampe TODOS los posts al idioma por defecto,
destruyendo las traducciones. El compose la exige (`:?required`) y el arranque,
ante la duda, saltea la migración en vez de correrla. Nada de esto valida al
cargar el módulo: `strapi build` levanta la config sin el env de runtime y una
validación ahí rompe el build de la imagen.

**El RBAC se registra en `register()`, nunca en `bootstrap()`.** El bootstrap
del plugin admin corre ANTES y ahí sincroniza los permisos del super admin y
borra los desconocidos. Registradas tarde, el super admin nunca recibe la fila.

**Los content-types ocultos del Content Manager devuelven 403 hasta al super
admin.** Por eso `agent` y `rss-feed` tienen su propio CRUD; no es capricho.

**El editor de notas va por `app.router.addRoute` en `register()`.** `app.router`
sólo existe ahí: llamarlo desde `bootstrap` deja el panel en blanco.

**Los tipos de Strapi están gitignoreados.** Tras tocar un content-type:
`cd apps/cms && pnpm exec strapi ts:generate-types`. Sin eso el typecheck falla
en cada `.update()`. El comando no necesita base de datos.

## Verificación

```sh
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @nib/web build
docker build -f apps/cms/Dockerfile . && docker build -f apps/web/Dockerfile .
```

El CI corre eso mismo. Este repo **no se deploya**: lo que se deploya son los
proyectos que lo adoptan, cada uno con su `Jenkinsfile` y su compose (hay
plantillas en `deploy/templates/`).
