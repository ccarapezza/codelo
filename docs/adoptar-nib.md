# Adoptar Nib en un proyecto

Nib es el motor; un proyecto es Nib **más** su vertical. Este documento dice
qué archivos son de quién y cómo se traen los cambios de arriba sin pelearse en
cada merge.

## Las tres clases de archivo

**A — Del motor.** Idénticos en todos los proyectos. Río abajo **no se editan
nunca**: si hace falta cambiar algo acá, el cambio va a Nib y baja por merge.

`apps/cms/src/lib/**` (salvo `verticals/`), `apps/cms/src/api/*` de los tipos
del motor, `apps/cms/src/admin/**` (salvo `verticals.ts` y `verticals/`),
`apps/cms/src/index.ts`, `apps/cms/config/**`, los Dockerfile; en la web,
`app/[lang]/{layout,globals.css,blog,etiqueta,[slug],opengraph-image}`,
`app/api/**`, `app/{sitemap,robots,manifest}.ts`, `components/**` (salvo
`vertical/`), `lib/**` (salvo `site.ts` y `vertical/`), `i18n/**`; en la raíz,
`package.json`, `deploy/deploy.sh`, `.github/workflows/ci.yml`.

**B — Compartidos con delta.** Del motor, pero el proyecto lleva unas líneas
propias. Es el **único** lugar donde se esperan conflictos, y por eso conviene
que el delta sea mínimo y esté documentado en el propio archivo.

Los `schema.json` de `agent`, `agent-action`, `tag`, `post`, `prompt-setting` y
`site-setting`; los `package.json` de las apps; `pnpm-lock.yaml` (en un
conflicto: quedarse con el propio y correr `pnpm install`).

**C — Del proyecto.** Nib deja un default vacío o neutro y no los toca más.

CMS: `src/verticals/*` y `src/admin/verticals.ts` (+ `verticals/`),
`src/api/<vertical>/`. Web: `lib/site.ts`, `lib/vertical/*`,
`components/vertical/*`, `app/[lang]/{theme.css,vertical.css,fonts.ts,page.tsx}`,
`app/[lang]/(vertical)/**`, `messages/*.vertical.json`, `public/brand/**`.
Raíz: `Jenkinsfile`, `docker-compose*.yml`, `docs/**`, `README.md`, `CLAUDE.md`.

## Las costuras

Lo que el motor le pide al proyecto, todo con default vacío:

| Costura | Qué define |
| --- | --- |
| `verticals/prompt-defaults.ts` | El tema: voz, reglas del dominio, catálogo de escenas de portada |
| `verticals/cron.ts` | Tareas programadas propias |
| `verticals/agent-roles.ts` | Roles de agente además de los tres del motor |
| `verticals/director-filters.ts` | Borradores que el Director no debe revisar |
| `verticals/prompt-fields.ts` | Campos de prompt propios |
| `verticals/rss-scope.ts` | Qué ítems del pool RSS son del tema |
| `verticals/brand.ts` | Colores, tipografías y logo de las placas de redes |
| `admin/verticals.ts` | Widgets, menú, rutas y la identidad visual del panel |
| `lib/site.ts` | Nombre, dominio, idiomas y navegación del sitio |
| `app/[lang]/theme.css` | Los colores del sitio |
| `components/vertical/index.ts` | Cuatro ranuras opcionales de la web |

## Traer cambios de Nib

```sh
git remote add upstream git@github.com:ccarapezza/nib.git   # una sola vez
git fetch upstream && git merge upstream/main
```

Si el proyecto nació de Nib, es un merge normal. Si nació aparte —copiado por
archivos, como pasó con los primeros—, el primer merge necesita
`--allow-unrelated-histories` y se resuelve a mano una vez: la versión de Nib
para todo lo de clase A, la propia para la C. Después es un merge normal.

## Dos cosas que muerden

**PROJECT_SLUG no tiene default en producción.** Con ella se arman las claves
del core store, y una de esas claves es lo único que impide que la migración de
i18n vuelva a correr y re-estampe todos los posts al idioma por defecto. El
compose la exige (`:?required`) y el arranque, ante la duda, saltea la
migración en vez de correrla.

**Un rol de agente nuevo va en tres lugares.** El runner en
`verticals/agent-roles.ts`, la etiqueta en `admin/verticals.ts`, y el valor en
el enum de los `schema.json` de `agent` y `agent-action` — Postgres respalda el
enum con un CHECK, así que si falta, el arranque falla en cuanto exista una fila
con ese rol.
