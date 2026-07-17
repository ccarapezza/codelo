#!/usr/bin/env bash
# codelo deploy script — invoked over SSH by Jenkins (deployDockerCompose).
# Lives at /opt/codelo/deploy/deploy.sh on the VPS.
#
# Usage: deploy/deploy.sh <branch> [--skip-build]
#
# The .env that compose reads is rendered+uploaded by Jenkins before this
# script runs. No migrate step: Strapi manages its own schema on boot.

set -euo pipefail

BRANCH="${1:-main}"
SKIP_BUILD=0
if [[ "${2:-}" == "--skip-build" ]]; then
  SKIP_BUILD=1
fi

cd "$(dirname "$0")/.."

echo "[deploy] fetching origin and checking out ${BRANCH}"
git fetch --tags --prune origin
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

if [[ "${SKIP_BUILD}" -eq 0 ]]; then
  echo "[deploy] building images"
  ${COMPOSE} build
else
  echo "[deploy] skipping build (--skip-build)"
fi

echo "[deploy] applying stack"
${COMPOSE} up -d --remove-orphans

echo "[deploy] pruning dangling images"
docker image prune -f

echo "[deploy] done"
