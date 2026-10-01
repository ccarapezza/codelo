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

## Comandos

```sh
docker compose -f docker-compose.dev.yml up -d   # Postgres y Redis
pnpm dev:cms            # Strapi; el primer arranque compila el panel
pnpm dev:web            # Next; `pnpm dev:all` levanta los dos
./scripts/local-up.sh   # instancia completa en Docker (genera .env.local)
```

Los `.env` salen de los `.env.example` de la raíz, `apps/cms` y `apps/web`. La
web lee el CMS sólo por REST (`lib/cms.ts`, `lib/pages.ts`, con `revalidate` de
60–300 s) y nunca toca la base.

Tests con vitest, en `apps/cms/test/` y junto al código (`src/lib/*.test.ts`).
Uno solo, desde `apps/cms`:

```sh
pnpm exec vitest --run src/lib/director-review.test.ts
pnpm exec vitest --run -t "nombre del caso"
CAPTURE=1 pnpm exec vitest --run test/preservation/capture.test.ts    # recaptura (ver abajo)
FEEDS_LIVE=1 pnpm exec vitest --run src/lib/feed-discovery.live.test.ts  # sale a la red
```

## La regla que ordena todo

Si un archivo nombra un tema, una marca o un dominio concreto, **está en el
lugar equivocado**. El motor no sabe de qué habla el sitio que lo usa. Antes de
cerrar un cambio:

```sh
./scripts/check-neutral.sh
```

Es esta regla ejecutable, y corre en CI. El script tiene que ser idéntico en el
motor y en cada proyecto: lo propio que un proyecto tenga fuera de las costuras
se excluye en `scripts/check-neutral.ignore`, no editando el script.

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

El orden es: decir ANTES qué fixtures se van a mover (en el commit, en el PR),
recapturar, y confirmar que el diff muestra sólo esas. Si aparece otra, el
error está en el código, no en la fixture. La captura nunca borra: una fixture
que sobra se borra a mano.

**Agentes.** Cuatro roles en el motor: redactor, director, explorador (elige
un tema dentro de su área, lo investiga en la web y escribe por el camino del
redactor) e image-generator. En ese camino compartido, `runRedactor` tiene
tres modos —investigación, asignado, libre— y sólo el libre mira el pool de
RSS: en el de investigación los apuntes SON el contexto. Cuando el Explorador
decidía "hay contexto" por el RSS, un área sin noticias recibía las reglas del
modo análisis encima de sus apuntes, y `requireNewsContext` tiraba la
investigación ya pagada. El runner despacha por nombre y busca en
`verticals/agent-roles.ts` lo que no reconoce. Un rol nuevo va en TRES lugares:
el runner, la etiqueta del panel (`admin/verticals.ts`) y el enum de los
`schema.json` de `agent` y `agent-action`. Postgres no respalda el enum
—Strapi 5.54 no crea CHECK—; lo valida `strapi.documents()`, que rechaza el
alta de un agente con un rol fuera del enum. La auditoría escribe por
`strapi.db.query`, que no valida: una fila con un rol sin registrar entra igual
y el panel la muestra sin etiqueta. Una ACCIÓN nueva de auditoría va en cuatro:
el tipo `AgentAction` (`lib/audit.ts`), el enum de `agent-action`, y
`ACTION_LABEL`/`ACTION_COLOR` de `AuditPage` con su clave en los catálogos.

**Director.** No sólo aprueba o rechaza: puede reescribir el título y quitar
del cuerpo hasta tres frases periféricas sin fuente (`removedClaims`); más que
eso, `enforceRemovalCap` lo convierte en rechazo. Al rechazar cita lo que da por
ausente (`unsupportedClaims`) y `lib/director-review.ts` lo busca en la
evidencia que él tuvo delante: si aparece, le pide UNA segunda lectura en la
misma conversación, mostrándole dónde. El motor nunca aprueba solo —encontrar
las palabras no prueba que la fuente diga lo mismo—; muestra y relee. La
búsqueda tiene que mirar exactamente lo que el revisor leyó (mismos cortes,
mismas etiquetas `[n]`): si no, le señala un texto que nunca vio. Revisa con
`openaiDirectorModel` si está, o con el modelo de texto. En la auditoría quedan
`director_recheck` y `director_trimmed`, con lo encontrado y lo quitado.

**Crons.** `config/cron-tasks.ts` tiene los dos del motor (agentes y RSS) y
spreadea `verticals/cron.ts`. Agregar una tarea propia no toca el archivo del
motor.

**Idiomas.** Una nota es un documento con una fila por idioma. En Strapi 5,
`delete`, `unpublish` y `publish` SIN `locale` actúan sólo sobre el idioma por
defecto: para bajar una nota entera va `locale: "*"`, y para preguntar si
alguna versión está publicada, `findMany` (`findOne` no acepta `"*"`). La
pantalla de Notas borraba así y dejaba la traducción huérfana y publicada; en
producción aparecieron seis, tres de ellas visibles en el sitio en inglés de un
proyecto.

**Portadas.** Los pools del sorteo (encuadre, tratamiento, luz, acabado)
están en `lib/cover-pools.ts` y un proyecto los reemplaza desde
`verticals/cover-pools.ts`; lo que sabe de sus anclas lo suma con
`verticals/anchor-enrichers.ts`. Todo camino que genera una portada pasa por
`generateCoverForPost` (`lib/cover-pipeline.ts`): no escribir otra copia.

Además de los agentes, `src/index.ts` registra en `register()` un middleware de
`strapi.documents` que funciona como red de seguridad: cada create, update o
publish de un post dispara en segundo plano `ensurePostCover` y
`ensurePostTranslation`, que no hacen nada si la nota ya tiene portada y
traducción. Un publish por REST o desde Notas también las genera, y la propia
traducción vuelve a entrar al middleware: se saltea por su locale.

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

**Una ruta sin entrada de menú va por `app.router.addRoute` en `register()`.**
`app.router` sólo existe ahí: llamarlo desde `bootstrap` deja el panel en
blanco. Así están Audit y el generador viejo. Una pantalla CON entrada de menú
no lo necesita, porque `addMenuLink` registra su ruta: el editor de notas pasó
de un caso al otro cuando ganó la entrada «Nueva nota».

**El editor de notas se remonta cuando cambia la nota** (`key` por `?id=`). Su
estado se arma al montar; sin eso, pasar de editar una nota a «Nueva nota»
dejaba el formulario con la anterior y guardar la duplicaba.

**El menú lateral NO respeta el orden de registro.** Strapi junta los links de
plugins con los generales, los ordena ALFABÉTICAMENTE por etiqueta y recién ahí
por `position` (con `?? 6` de fallback). Cambiar el orden de los `addMenuLink`
no hace nada; lo único que manda es `position`. Strapi se reserva 0 Home · 1
Content Manager · 2 Releases · 4 Media · 5 CTB · 7 Marketplace · 9 Settings, así
que lo del motor va en decimales entre Home y el Content Manager (constante
`POS` en `app.tsx`). Las
posiciones son únicas a propósito: el comparador de Strapi nunca devuelve 0, y
con empates el orden queda a merced de cómo desempate el sort de V8.

**El panel trae la marca de Nib por defecto, no la de Strapi.** Vive en
`src/admin/default-brand.ts` (archivo del MOTOR, nombrado por su rol) y
`app.tsx` la mergea con `admin/verticals.ts`, clave por clave y locale por
locale. Lo que el panel no esconde es sobre qué corre: el subtítulo del login
lo dice y la pantalla de versión de Strapi queda intacta.

**El panel está en castellano e inglés, y el castellano es la FUENTE.** Los
textos viven en `src/admin/translations/{es,en}.json` y se leen con `useT()`.
Las pantallas se pensaron y se escribieron en castellano —el tono, el voseo, las
advertencias— y el inglés se redactó contra él: para cambiar un texto se cambia
el castellano primero. `es.json` es además el respaldo, así que una clave que
falte muestra español y no un hueco. `config.locales: ["es"]` en `app.tsx` es lo
que habilita el selector; sin esa línea Strapi ofrece sólo inglés y el panel
queda mezclado.

⚠️ **`t()` devuelve la entrada tal cual si no es una clave conocida.** Eso es lo
que permite que las tarjetas que agrega un proyecto (`admin/verticals.ts`) sigan
escribiendo sus etiquetas como texto literal sin armar catálogos.

⚠️ **Un `t()` fuera de alcance es pantalla en blanco, y nada lo detecta**:
`tsconfig` excluye `src/admin/` y esbuild sólo transforma. Pasó de verdad, con
`t()` sustituido dentro de constantes de MÓDULO. Si una constante de módulo
necesita texto, guarda la CLAVE y se traduce al renderizar.

**Los colores de las placas de redes están en la BASE, no en código.** Viven en
`site-setting` y se editan en Sitio e integraciones → Identidad visual; el
renderer los lee con `getRenderContext(strapi)`. En `verticals/brand.ts` quedan
sólo las tipografías y el logo por defecto, que son archivos: una fuente que no
esté en `assets/fonts/` no da error, dibuja con otra.

⚠️ **Los colores NO llevan `default` en el schema.** Una columna con default no
se distingue de una configurada a mano, y la semilla —que escribe sólo lo
vacío— la saltearía para siempre: un proyecto que ya tiene fila de
`site_settings` se quedaría con los colores de Nib sin un solo aviso. Vacío =
el del motor, resuelto en `resolveBrand()`.

⚠️ **`accentDeep` nunca va como texto.** Es el cierre del degradé y los velos:
va DEBAJO de algo. `stat` y `countdown` lo usaban para su número de 460px
—herencia del prototipo, donde el slot era naranja brillante— y con el azul
profundo de Nib eso daba 1.97:1 sobre su propio fondo. Hay un test que lo
impide.

**`@strapi/design-system` y `@strapi/icons` van PINEADOS a la versión exacta
que usa el Strapi instalado** (hoy 2.2.4 para Strapi 5.54). Estaban en
`^2.0.0-rc.30` y `*`, así que nuestro código resolvía 2.2.3 mientras el admin de
Strapi corría 2.0.0-rc.30: dos copias del mismo design system en un panel.
Pinearlas convierte un desajuste futuro en un conflicto de install visible en
vez de una resolución silenciosa — al subir Strapi hay que subir estas dos.

**Actualizar Strapi rompe los ocultamientos cosméticos, no la arquitectura.**
Al pasar de 5.31 a 5.54 el ítem del Marketplace reapareció porque cambió de la
ruta interna `/marketplace` al sitio externo `market.strapi.io`, y apareció una
barra de anuncio nueva a todo el ancho. Los dos viven en
`src/admin/promos-strapi.css`, que se apoya en el DOM de Strapi a propósito y
hay que mirar después de cada actualización. Cuando falla, lo oculto REAPARECE:
se ve en una captura y no rompe nada.

**El formato de una imagen generada sale de sus bytes, nunca del proveedor.**
Gemini por OpenRouter devuelve JPEG y gpt-image PNG, y eso cambia de un modelo
al siguiente. resvg decodifica según el mime de la data URI, no según el
contenido: un JPEG etiquetado PNG se sube y se ve bien en un navegador, pero la
placa sale con el fondo de marca, sin la imagen y sin una línea en el log. Las
imágenes se suben sin extensión —`uploadImageToStrapi` la pone con
`lib/image-format.ts`— y a una placa entran por `bgUriForRender`, que devuelve
`null` para lo que satori no mide (con un WEBP no cae a "sin imagen": tira).

**En el panel, `fetch` sobre una URI `data:` lo bloquea la CSP.** `connect-src`
sólo permite `'self'` y `https:`; las imágenes `data:` se ven porque para eso
manda `img-src`. El error llega como un TypeError genérico y no nombra la CSP.
Para pasar una data URI a archivo: `dataUriToBlob` (`admin/utils/data-uri.ts`).

**Los tipos de Strapi están gitignoreados.** Tras tocar un content-type:
`cd apps/cms && pnpm exec strapi ts:generate-types`. Sin eso el typecheck falla
en cada `.update()`. El comando no necesita base de datos.

## Verificación

```sh
./scripts/check-neutral.sh
(cd apps/cms && pnpm exec strapi ts:generate-types)   # antes del typecheck
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @nib/web build
docker build -f apps/cms/Dockerfile . && docker build -f apps/web/Dockerfile .
```

El CI corre eso mismo. En el CMS, `lint` y `typecheck` son el mismo `tsc`, que
no mira `src/admin/`: un cambio al panel no está verificado hasta que pasa el
`docker build` del CMS. Este repo **no se deploya**: lo que se deploya son los
proyectos que lo adoptan, cada uno con su `Jenkinsfile` y su compose (hay
plantillas en `deploy/templates/`).
