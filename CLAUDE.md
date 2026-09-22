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

**Prompts.** El texto editorial de un proyecto vive en la BASE, en el single
type `prompt-setting`, y se edita desde Configuración editorial. El motor sólo
trae los valores neutros de `lib/prompt-defaults.ts` (`ENGINE_PROMPT_KEYS` es la
fuente de verdad: de ahí salen la allowlist del controller y el loader). Un
proyecto carga los suyos una vez con `verticals/seed.ts`, que rellena únicamente
lo que está vacío.

⚠️ No agregues texto editorial a un archivo. Si un prompt necesita algo que el
dominio decide, es un campo nuevo — no una constante. Y si un campo tiene que ser
editable, va en los tres lugares a la vez: `ENGINE_PROMPT_KEYS`, el `schema.json`
y una tarjeta en la pantalla. `test/settings-contract.test.ts` lo verifica: cuando
esos tres se desincronizaron, el panel mintió en las dos direcciones sin un solo
error en el log.

**Los prompts están congelados.** `test/preservation/` guarda el texto que arman
hoy con los ajustes reales de los proyectos que adoptan el motor. Si tocás un
prompt, el test dice exactamente cuál cambió; si el cambio es deliberado se
recaptura con `CAPTURE=1` y el diff de los fixtures es lo que se revisa. Nunca
recapturar para que un test deje de molestar.

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

**El menú lateral NO respeta el orden de registro.** Strapi junta los links de
plugins con los generales, los ordena ALFABÉTICAMENTE por etiqueta y recién ahí
por `position` (con `?? 6` de fallback). Cambiar el orden de los `addMenuLink`
no hace nada; lo único que manda es `position`. Strapi se reserva 1 Content
Manager · 2 Releases · 4 Media · 5 CTB · 7 Marketplace · 9 Settings, así que lo
del motor va en negativo (constante `POS` en `app.tsx`) para quedar antes. Las
posiciones son únicas a propósito: el comparador de Strapi nunca devuelve 0, y
con empates el orden queda a merced de cómo desempate el sort de V8.

**El panel trae la marca de Nib por defecto, no la de Strapi.** Vive en
`src/admin/default-brand.ts` (archivo del MOTOR, nombrado por su rol) y
`app.tsx` la mergea con `admin/verticals.ts`, clave por clave y locale por
locale. Lo que el panel no esconde es sobre qué corre: el subtítulo del login
lo dice y la pantalla de versión de Strapi queda intacta.

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
