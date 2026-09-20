# Nib

Motor de redacción asistida por IA sobre Strapi 5 + Next.js 16, pensado para
montar portales de contenido: un equipo de agentes que leen fuentes, escriben,
revisan y publican; un generador de portadas; un estudio de piezas para redes; y
un panel de gestión de notas pensado para editores, no para el Content Manager
de Strapi.

Este repo es **el producto**, sin ningún vertical. Los proyectos que lo usan lo
agregan como `upstream` y le suman lo suyo por las costuras que el motor define
(ver `docs/adoptar-nib.md`).

## Qué trae

| | |
| --- | --- |
| `apps/cms` | Strapi 5: motor de agentes, portadas, RSS, Social Studio, gestor de notas, RBAC |
| `apps/web` | Next.js 16 (App Router, next-intl, shadcn) con la base visual neutra |

**El motor de agentes.** Tres roles: el *redactor* escribe a partir de las
noticias que le tocan, el *director* revisa contra la evidencia que el redactor
tuvo a la vista y publica o rechaza, y el *generador de imágenes* produce la
portada. Corren por schedule o a demanda, y cada acción queda auditada.

**La web.** Blog, etiquetas, páginas del CMS por slug, SEO completo (sitemap,
hreflang, JSON-LD, tarjetas de compartir), vista previa de borradores y modo
claro/oscuro. Sin diseño propio: grises neutros, lista para vestir.

## Levantarlo

```sh
pnpm install
docker compose -f docker-compose.dev.yml up -d     # postgres :5436, redis :6382

cp .env.example .env
cp apps/cms/.env.example apps/cms/.env             # secrets: openssl rand -base64 32
cp apps/web/.env.example apps/web/.env

pnpm dev:cms    # Strapi en http://localhost:1340 (el primer arranque compila el panel)
pnpm dev:web    # Next en http://localhost:3400
```

Primer arranque: crear el usuario admin en `/admin`, y desde ahí configurar las
fuentes RSS y los agentes. Necesitan `OPENAI_API_KEY` en el env del CMS.

## Verificación

```sh
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @nib/web build
```
