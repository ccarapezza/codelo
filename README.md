# Cogollos del Oeste (codelo)

Portal de información de la agrupación cannábica **Cogollos del Oeste**
(oeste de la Ciudad de Buenos Aires): cultivo responsable, REPROCANN, actividades
y noticias. Monorepo hermano de fulbo/x100 — misma arquitectura, sin APIs
externas de datos: **todo el contenido vive en el CMS**.

## Apps

| App | Descripción |
| --- | --- |
| `apps/codelo-web` | Frontend Next.js (App Router, ES-only, shadcn) — blog + secciones administrables |
| `apps/codelo-cms` | Strapi 5: posts, páginas estáticas, eventos, motor de agentes IA y settings |

## Desarrollo

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # postgres :5435, redis :6381
pnpm install
cp apps/codelo-cms/.env.example apps/codelo-cms/.env   # generar secrets reales
cp apps/codelo-web/.env.example apps/codelo-web/.env

pnpm dev:cms   # Strapi en :1339 (primer boot compila el admin)
pnpm dev:web   # Next.js en :3200
```

Los puertos de dev están corridos respecto de fulbo (5432/1337/3000),
pingpong (5433) y x100 (5434/1338/3100) para convivir en la misma máquina.

## Contenido

- **Posts** (`/api/posts`): blog/noticias — manual o generado por los agentes IA.
- **Pages** (`/api/pages`): páginas estáticas por slug; la web mapea rutas fijas
  a slugs conocidos: `quienes-somos`, `reprocann`, `contacto`.
- **Events** (`/api/events`): actividades con fecha/lugar → `/actividades`.

## Deploy

Docker Compose (`docker-compose.prod.yml`) detrás del Caddy compartido del VPS
(red externa `proxy-edge`). Sin migraciones propias: Strapi gestiona su schema.
Pipeline Jenkins → ver `Jenkinsfile`.
