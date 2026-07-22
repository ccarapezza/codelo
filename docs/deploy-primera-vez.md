# Primer deploy a producción

Checklist del arranque inicial en `cc-lab-contabo`. Para redeploys normales
basta con correr el pipeline; esto es lo que hay que hacer **una sola vez**.

El pipeline (`Jenkinsfile`) usa la shared library `westcode-shared`, entra por
SSH a `cc-lab-contabo`, sincroniza la rama `main` en `/opt/codelo` y levanta
`docker-compose.prod.yml`. No publica puertos al host: los containers se cuelgan
de la red externa `proxy-edge`, donde el Caddy compartido de `/opt/proxy`
termina TLS.

## 1. Antes de correr el pipeline

**Credenciales en Jenkins.** El `Jenkinsfile` espera estas once, todas de tipo
*Secret text*:

```
codelo-postgres-password          codelo-strapi-app-keys
codelo-strapi-api-token-salt      codelo-strapi-admin-jwt-secret
codelo-strapi-jwt-secret          codelo-strapi-transfer-token-salt
codelo-strapi-encryption-key      codelo-internal-api-key
codelo-redis-password             codelo-openai-api-key
codelo-openrouter-api-key
```

`scripts/generate-prod-secrets.sh` genera los valores aleatorios. Los de
OpenAI y OpenRouter son las claves reales de cada proveedor.

> `OPENAI_IMAGE_API_KEY` aparece en el compose pero **no** hace falta como
> credencial: `getOpenAIImageKey()` cae a `OPENAI_API_KEY` cuando está vacía.
> Sólo se define si se quiere una clave separada para generación de imágenes.

**DNS y Caddy.** Los dos nombres tienen que resolver al VPS y estar declarados
en el Caddyfile de `/opt/proxy`:

| Dominio | Container | Puerto |
| --- | --- | --- |
| `cogollosdeloeste.com.ar` | `codelo-web` | 3000 |
| `cms.cogollosdeloeste.com.ar` | `codelo-cms` | 1337 |

**Red externa.** `proxy-edge` tiene que existir antes del primer `up`:

```bash
docker network inspect proxy-edge >/dev/null 2>&1 || docker network create proxy-edge
```

## 2. Correr el pipeline

Dejar `SKIP_BUILD` en `false`. La primera corrida compila las dos imágenes y
tarda bastante (el admin de Strapi solo son ~30 s de bundling, más el resto).

No hay servicio de migraciones: Strapi crea su schema en el boot. Las tablas de
`cultivar` y `operador-semilla` se crean solas la primera vez.

## 3. Después del primer deploy

```bash
curl -sf https://cogollosdeloeste.com.ar/api/health   # {"status":"ok","cms":"ok"}
curl -si https://cms.cogollosdeloeste.com.ar/_health  # 204
```

**Crear el primer admin de Strapi** en `https://cms.cogollosdeloeste.com.ar/admin`.

**Cargar el contenido inicial**: las páginas con slug `quienes-somos`,
`reprocann` y `contacto` (sin ellas la web muestra un placeholder, no rompe), y
los agentes y fuentes RSS desde el admin.

### ⚠️ Disparar los sync de INASE a mano

Esto es lo más fácil de olvidar. Los crons corren **semanal** (cultivares) y
**cada 2 días** (operadores), así que recién levantado el sitio `/semillas`
queda vacío hasta una semana. Hay que forzarlos una vez:

```bash
KEY=<el valor de la credencial codelo-internal-api-key>

# Padrón: ~3.000 operadores, un request, un par de segundos.
docker exec codelo-cms sh -c "curl -s -X POST -H 'x-internal-key: $KEY' \
  http://localhost:1337/api/inase/sync-operadores"

# Catálogo: ~149 requests paginados contra INASE, unos 6 minutos.
docker exec codelo-cms sh -c "curl -s -X POST -H 'x-internal-key: $KEY' \
  --max-time 900 http://localhost:1337/api/inase/sync-cultivares"
```

Verificar los conteos (deberían dar del orden de 3.000 y 67):

```bash
curl -s "https://cms.cogollosdeloeste.com.ar/api/operador-semillas?pagination[pageSize]=1" | head -c 200
curl -s "https://cms.cogollosdeloeste.com.ar/api/cultivares?pagination[pageSize]=1" | head -c 200
```

Si el de cultivares aborta con «página vacía» o «respuesta inesperada», no es un
bug del deploy: es la guarda que evita espejar un catálogo truncado cuando INASE
cambia algo. Ver `src/lib/inase/cultivares.ts`.

> El container del CMS no trae `curl`. Usar `wget`:
> `docker exec codelo-cms wget -qO- -T 900 --header="x-internal-key: $KEY" --post-data="" http://localhost:1337/api/inase/sync-cultivares`

### ⚠️ Y después, recrear el container web

Los fetchers de la web cachean con `revalidate: 3600`. Si alguien —o un
health check— toca `/semillas` mientras el sync todavía corre, Next guarda la
respuesta VACÍA y la sirve por una hora: el CMS tiene los 67 cultivares y la
web muestra cero. Pasó en el primer deploy.

Un `restart` no alcanza, porque conserva el filesystem con `.next/cache`. Hay
que recrear:

```bash
cd /opt/codelo && docker compose -f docker-compose.prod.yml up -d --force-recreate --no-deps web
```

Lo más simple es hacer los dos sync ANTES de mandar tráfico al sitio, y usar
esto solo si quedó cacheado en vacío.

## Notas de configuración verificadas

- **`CRON_ENABLED` no está en el compose y su default es `true`**, así que los
  cuatro crons (agentes, RSS, Boletín, INASE) corren en producción.
- **`NEXT_PUBLIC_CMS_URL` va como variable de runtime, no como build arg.**
  Alcanza porque sólo se lee del lado del servidor — ningún componente cliente
  la usa. Si alguna vez un `"use client"` necesita leerla, hay que pasarla
  también como `build.args` o quedará `undefined` en el bundle.
- La web sigue el patrón fail-soft: si el CMS no responde, las listas quedan
  vacías en silencio en vez de romper la página. Un `/semillas` vacío tras el
  deploy casi siempre significa que faltan los sync de arriba.
