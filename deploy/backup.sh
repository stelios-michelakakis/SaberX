#!/usr/bin/env bash
# Daily pg_dump backup of the EDF SABER Postgres volume.
#
# Cron entry (run as root or a user with docker access):
#   30 2 * * * /opt/edf-saber/deploy/backup.sh >> /var/log/edfsaber-backup.log 2>&1
#
# Environment variables (all optional):
#   COMPOSE_DIR   path to the directory containing docker-compose.yml         (default: /opt/edf-saber)
#   BACKUP_DIR    destination directory for *.sql.gz files                    (default: /var/backups/edfsaber)
#   KEEP_DAYS     how many days of backups to retain                          (default: 7)
#
# The script reads POSTGRES_USER and POSTGRES_DB from the project's .env so
# you don't have to hardcode credentials twice.

set -euo pipefail

COMPOSE_DIR="${COMPOSE_DIR:-/opt/edf-saber}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/edfsaber}"
KEEP_DAYS="${KEEP_DAYS:-7}"

cd "$COMPOSE_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

PG_USER="${POSTGRES_USER:-edfsaber}"
PG_DB="${POSTGRES_DB:-edfsaber}"

mkdir -p "$BACKUP_DIR"
TARGET="${BACKUP_DIR}/edfsaber-$(date +%F-%H%M).sql.gz"

# pg_dump streamed straight into gzip — no intermediate temp file.
docker compose exec -T postgres pg_dump -U "$PG_USER" "$PG_DB" \
  | gzip -9 \
  > "$TARGET"

# Rotate
find "$BACKUP_DIR" -maxdepth 1 -type f -name 'edfsaber-*.sql.gz' -mtime "+${KEEP_DAYS}" -delete

SIZE="$(du -h "$TARGET" | cut -f1)"
echo "$(date -Iseconds)  backup ok  $TARGET  ${SIZE}"
