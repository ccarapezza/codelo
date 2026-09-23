#!/usr/bin/env bash
# Levanta una instancia local completa de Nib en Docker.
#
# La primera corrida genera .env.local con secretos aleatorios y construye las
# dos imágenes (unos minutos). Las siguientes reusan todo.
#
#   ./scripts/local-up.sh
#
# Para apagar:            docker compose -f docker-compose.local.yml down
# Para empezar de cero:   docker compose -f docker-compose.local.yml down -v

set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE=.env.local
COMPOSE="docker compose -f docker-compose.local.yml --env-file $ENV_FILE"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[nib] generando $ENV_FILE con secretos de juguete…"
  rand() { openssl rand -base64 24 | tr -d '\n'; }
  {
    echo "# Secretos SOLO para la instancia local. No sirven para producción."
    echo "STRAPI_APP_KEYS=$(rand),$(rand)"
    echo "STRAPI_API_TOKEN_SALT=$(rand)"
    echo "STRAPI_ADMIN_JWT_SECRET=$(rand)"
    echo "STRAPI_JWT_SECRET=$(rand)"
    echo "STRAPI_TRANSFER_TOKEN_SALT=$(rand)"
    echo "STRAPI_ENCRYPTION_KEY=$(openssl rand -hex 16)"
    echo "INTERNAL_API_KEY=$(rand)"
    echo "PREVIEW_SECRET=$(rand)"
    echo ""
    echo "# Opcionales: sin ellas el panel funciona igual, pero los agentes no"
    echo "# pueden escribir ni generar portadas."
    echo "OPENAI_API_KEY="
    echo "OPENAI_ADMIN_KEY="
    echo "OPENROUTER_API_KEY="
  } > "$ENV_FILE"
fi

echo "[nib] construyendo imágenes (la primera vez tarda)…"
$COMPOSE build

echo "[nib] levantando…"
$COMPOSE up -d

echo "[nib] esperando a que el CMS responda…"
for i in $(seq 1 90); do
  if curl -fsS -o /dev/null http://localhost:1340/_health 2>/dev/null; then break; fi
  sleep 2
done

cat <<TXT

  Nib está corriendo:

    Panel    http://localhost:1340/admin     (la primera vez, crear el usuario admin)
    Sitio    http://localhost:3400

  Los agentes necesitan una OPENAI_API_KEY en $ENV_FILE; sin ella el resto del
  panel funciona igual. Los crons vienen apagados a propósito.

  Logs:    docker compose -f docker-compose.local.yml logs -f cms
  Apagar:  docker compose -f docker-compose.local.yml down

TXT
