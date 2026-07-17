# fulbo-cms

Strapi-based Content Management System for FULBO.

This app is intended for **internal editors** and **content managers**
who need to publish news, articles, banners and other non-core data.

---

## Responsibilities

- Provide an admin UI for editors.
- Store and expose editorial content:
  - News
  - Articles
  - Banners
  - Static pages
- Optionally enrich football entities with extra metadata.

---

## Non-Goals

- It is **not** the main statistics database.
  Core football stats are defined in `packages/db` and consumed
  by `fulbo-web` and `fulbo-stats-ingestor`.

---

## Tech Stack

- Strapi
- Node.js
- SQLite or PostgreSQL (depending on environment)

---

## Scripts (example)

```jsonc
{
  "scripts": {
    "develop": "strapi develop",
    "build": "strapi build",
    "start": "strapi start",
  },
}
```

---

## Integration

- `fulbo-web` can consume the Strapi API for:
  - News widgets
  - Article pages
  - Banners and promotions

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
