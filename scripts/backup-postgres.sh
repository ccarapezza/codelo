#!/usr/bin/env bash
# Daily backup for the production stack. Captures both Postgres and the
# Strapi uploads volume (cms-uploads). Designed to be run on the VPS via
# cron — see docs/vps-bootstrap.md for the canonical crontab line.
#
# Stores backups locally in /var/backups/codelo and (optionally) ships them to
# S3-compatible storage via rclone (configure with: rclone config).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/codelo}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"   # e.g. "b2:codelo-backups" — leave empty to skip
PG_CONTAINER="${PG_CONTAINER:-codelo-postgres}"
CMS_CONTAINER="${CMS_CONTAINER:-codelo-cms}"
UPLOADS_PATH="${UPLOADS_PATH:-/repo/apps/codelo-cms/public/uploads}"
DB_NAME="${DB_NAME:-codelo}"
DB_USER="${DB_USER:-codelo}"

mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d-%H%M%S)
PG_FILE="$BACKUP_DIR/codelo-pg-$TS.sql.gz"
UPLOADS_FILE="$BACKUP_DIR/codelo-uploads-$TS.tar.gz"

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

find "$BACKUP_DIR" -name "codelo-pg-*.sql.gz"    -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name "codelo-uploads-*.tar.gz" -mtime "+$RETENTION_DAYS" -delete

echo "[$(date -Iseconds)] backup complete: pg=$(du -h "$PG_FILE" | cut -f1) uploads=$(du -h "$UPLOADS_FILE" | cut -f1)"
