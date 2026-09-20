# Nib — la plataforma compartida

Estado: decidido el 2026-09-20, sin implementar todavía.

## Qué es

`codelo` y `fulbo` son hoy el mismo backend copiado dos veces: un motor de
agentes de redacción sobre Strapi (director · redactor · generador de imágenes),
el pipeline de portadas, el Social Studio y el gestor de notas del panel. Se
copió por archivos, no por fork, así que **los dos repos no comparten un solo
commit** y cada arreglo se paga dos veces. Medido el 2026-09-19: de los 129
archivos que ambos CMS tienen en común, **59 ya divergieron** (46 %), y ninguno
de los dos tiene todas las mejoras.

**Nib** es el producto que sale de ahí: el motor, sin vertical. Cada portal pasa
a ser Nib + sus verticales.

El nombre es provisional en el sentido de que se puede cambiar, pero conviene
decidirlo antes de la Fase 2 porque queda horneado en identificadores que se
comparten entre proyectos (ver abajo).

| Qué | Valor |
| --- | --- |
| Producto | Nib |
| Dominio | `nib.studio` (libre al 2026-09-20; `.com` está tomado) |
| Repos / apps | `nib-cms`, `nib-web` |
| Namespace de permisos | `nib.site-settings.manage`, `nib.prompt-settings.manage` |
| Claves del core store | `nib:rss-last-run`, `nib:i18n-posts-migrated` |

⚠️ El uid de una acción RBAC lo valida Strapi con `/^[a-z]([a-z|.|-]+)[a-z]$/`:
**minúsculas y guiones, sin números**. Cualquier renombre futuro tiene que
respetar eso y migrar las filas de `admin::permission` existentes.

Colisiones conocidas, para no descubrirlas tarde: el paquete npm `nib` está
tomado (una librería de CSS para Stylus) — `nib-cms` y `nib-web` están libres, y
si algún día se publica conviene scope propio (`@westcode/nib-*`). Los handles
de GitHub `nib` y `nibstudio` también están tomados, así que los repos van bajo
la cuenta de siempre. Existen además marcas ajenas llamadas "nib" (una
aseguradora australiana, el Nordic Investment Bank); otro rubro, pero no se hizo
chequeo legal.

## Alcance

**Entra en Nib**: motor de agentes (roles, schedules, batch, auditoría, gates de
duplicados y de calco); pipeline de portadas; ingesta RSS con salud por feed;
Social Studio (placas, carrusel, video); traducción; gestor de notas del panel
(Notas + editor unificado + vista previa + destacadas); RBAC de las pantallas
custom; `site-setting` y `prompt-setting`; el deploy entero (compose,
Jenkinsfile, backup), que ya es idéntico en los dos repos; y una web base con
los tokens neutros de shadcn.

**No entra**: INASE, Boletín Oficial, clima y semillas (codelo); api-football,
el rol `analyst`, `match-context`, torneos, el ingestor y `packages/db` (fulbo).

El Boletín Oficial no es genérico en sus términos, pero sí como patrón ("fuente
institucional que alimenta news-context"). Queda afuera; si aparece un tercer
proyecto que lo necesite, recién ahí se extrae la interfaz.

## Las fases

**Fase 0 — Dos parches a fulbo, ya.** No dependen de nada de esto y son
problemas de producción hoy:
- el Director revisa contra un contexto reconstruido y rechaza notas bien
  fundadas (es el bug que codelo arregló en 60a7de2);
- las pantallas custom del panel no tienen RBAC: cualquier usuario admin
  (Editor, Author) puede abrir y guardar Site Settings y Prompts IA.

**Fase 1 — Nivelar codelo ← fulbo.** Nivelar *una* dirección, no las dos: codelo
es la semilla y tiene que salir sin deuda. Las 9 mejoras de codelo llegan a
fulbo adoptando Nib, no como cherry-picks sueltos.

**Fase 2 — Nacer Nib desde codelo, con historia.** `git clone` y sacar los
verticales en commits limpios. Con historia y no `git init` vacío: es lo que le
permite a codelo agregar Nib como remote y mergear upstream para siempre. La
historia de codelo está auditada y limpia (sin `.env`, sin secretos, 9.7 MB).

**Fase 3 — Fulbo adopta Nib.** Como no hay ancestro común, va un solo
`git merge --allow-unrelated-histories upstream/main`, resolviendo a mano una
vez (la versión de Nib en todo lo que es motor, la de fulbo en sus verticales).
Es un merge feo de un día; después los merges son normales.

## Las costuras

Esto es lo que decide si el modelo sobrevive. Si río abajo se editan archivos de
Nib, el primer `merge upstream` conflictúa en todo y se abandona.

| Qué varía por proyecto | Dónde vive | Estado |
| --- | --- | --- |
| Prompts del vertical | `prompt-setting` (editable desde el admin) | existe, fue diseñado para esto |
| Nombre y voz de marca | `brandName` en prompt-settings | existe en codelo; falta sacarlo de los prompts de fulbo |
| Content-types propios | `src/api/<vertical>/` | Nib nunca toca ese directorio |
| Crons propios | `src/verticals/cron.ts`, spreadeado en `config/cron-tasks.ts` | por hacer (hoy están inline) |
| Menú y widgets del panel | `src/admin/verticals.ts`, leído por `app.tsx` | por hacer |
| Identidad de la web | `lib/site.ts` + `theme.css` con los tokens | `site.ts` existe; los tokens ya están aislados en `:root` + `@theme inline` |
| Páginas propias de la web | `app/[lang]/(vertical)/` | por convenir |

## Ports pendientes (del discovery del 2026-09-19)

**De codelo a fulbo** — `sourceContext` + revisión del Director en dos bloques y
la regla "paráfrasis ≠ invención"; RBAC de las pantallas custom; el filtro de
keywords empujado a la query del RSS con stopwords y orden por `fetchedAt`;
`lastError`/`lastItemCount` por feed y `fetchFeed` que tira el error en vez de
tragárselo; CRUD propio para agentes y feeds; el gestor de notas entero;
`requireNewsContext` y `defaultTag`; `brandName`; el panel usable en mobile; y
`pageMetadata()` en la web.

**De fulbo a codelo** — `avalancha()`, el finalizador que arregla la correlación
entre dimensiones del seed; `fixThemeVariants()`, que sortea la variante de
escena en vez de dejar que la elija el modelo (medido en fulbo: la variante (a)
salió 122 veces contra 12 de las otras tres juntas); el `SAFETY_SUFFIX` que
evita los decapitados; la CSP con `*.clarity.ms` por comodín (**Clarity está
roto en producción en codelo**: el tag baja un segundo script desde
`scripts.clarity.ms`); el mecanismo de relevancia editorial, que es lo que le
falta a `run-batch` para ser usable; y `run-batch-internal`.
