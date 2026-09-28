#!/usr/bin/env bash
# Daily backup for the production stack. Captures both Postgres and the
# Strapi uploads volume (cms-uploads). Designed to be run on the VPS via
# cron — see docs/vps-bootstrap.md for the canonical crontab line.
#
# Stores backups locally in /var/backups/<slug> and (optionally) ships them to
# S3-compatible storage via rclone (configure with: rclone config).

set -euo pipefail

# Los nombres salen del slug de la instalación, el mismo que usa compose para
# los containers (`<slug>-postgres`, `<slug>-cms`). Si el cron no lo exporta se
# lee del .env que Jenkins deja en la raíz del repo del VPS (/opt/<slug>/.env):
# sin eso, una instancia que heredara este script respaldaría `nib-postgres`,
# un container que no existe, y el backup fallaría todas las noches. Se lee de
# a una clave —no se hace `source`— porque el archivo trae secretos con
# caracteres que bash interpretaría.
ENV_FILE="${ENV_FILE:-$(cd "$(dirname "$0")/.." && pwd)/.env}"
leer_env() {
  [[ -f "$ENV_FILE" ]] && sed -n "s/^$1=//p" "$ENV_FILE" | tail -n1 | tr -d "\"'" || true
}
SLUG="${PROJECT_SLUG:-$(leer_env PROJECT_SLUG)}"
SLUG="${SLUG:-nib}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/$SLUG}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# Los uploads se retienen MUCHO menos que los dumps, y no es una decisión de
# gusto: el dump comprimido pesa unas decenas de MB y el tarball de uploads más
# de un GB, pero el tarball es casi el mismo archivo todos los días —las
# imágenes ya subidas no cambian—, así que treinta copias son treinta veces lo
# mismo. En una instancia en producción, con 30 días para los dos, esto llegó a
# 68 GB y se comió el 40 % del disco. Lo que una copia vieja de uploads aporta
# sobre la última es poder recuperar un archivo BORRADO, que es raro; el
# historial que de verdad importa es el de la base, y ese se conserva entero.
UPLOADS_RETENTION_DAYS="${UPLOADS_RETENTION_DAYS:-7}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"   # e.g. "b2:<slug>-backups" — leave empty to skip
PG_CONTAINER="${PG_CONTAINER:-$SLUG-postgres}"
CMS_CONTAINER="${CMS_CONTAINER:-$SLUG-cms}"
UPLOADS_PATH="${UPLOADS_PATH:-/repo/apps/cms/public/uploads}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-$(leer_env POSTGRES_DB)}}"
DB_NAME="${DB_NAME:-$SLUG}"
DB_USER="${DB_USER:-${POSTGRES_USER:-$(leer_env POSTGRES_USER)}}"
DB_USER="${DB_USER:-$SLUG}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
PG_FILE="$BACKUP_DIR/$SLUG-pg-$TS.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/$SLUG-uploads-$TS.tar.gz"

echo "[$(date -Iseconds)] [pg] dumping $DB_NAME → $PG_FILE"
docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" | gzip > "$PG_FILE"

echo "[$(date -Iseconds)] [uploads] archiving $CMS_CONTAINER:$UPLOADS_PATH → $UPLOADS_FILE"
docker exec "$CMS_CONTAINER" tar -czf - -C "$(dirname "$UPLOADS_PATH")" "$(basename "$UPLOADS_PATH")" \
  > "$UPLOADS_FILE"

# Ship to remote (optional)
if [[ -n "$RCLONE_REMOTE" ]]; then
  for f in "$PG_FILE" "$UPLOADS_FILE"; do
    echo "[$(date -Iseconds)] uploading $(basename "$f") to $RCLONE_REMOTE"
    rclone copy "$f" "$RCLONE_REMOTE/" --quiet
  done
  rclone delete --min-age "${RETENTION_DAYS}d" "$RCLONE_REMOTE/" --quiet
fi

find "$BACKUP_DIR" -name "$SLUG-pg-*.sql.gz"      -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "$SLUG-uploads-*.tar.gz" -mtime "+$UPLOADS_RETENTION_DAYS" -delete

echo "[$(date -Iseconds)] backup complete: pg=$(du -h "$PG_FILE" | cut -f1) uploads=$(du -h "$UPLOADS_FILE" | cut -f1)"
