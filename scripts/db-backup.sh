#!/usr/bin/env bash
#
# Scheduled database backup — independent of deploys.
#
# Run from cron / a systemd timer every 15-30 min on the VPS. Each run writes a
# verified `pg_dump -Fc` into ./backups/ and rotates old ones. With this in place
# the worst-case data loss from any incident is one backup interval, not hours.
#
# Cron example (every 15 min), as the deploy user:
#   */15 * * * * cd /opt/delphic && ./scripts/db-backup.sh >> /var/log/delphic-backup.log 2>&1
#
# systemd timer: see docs/guides/DEPLOY-RUNBOOK.md.
#
# Env:
#   BACKUP_KEEP        how many dumps to retain (default 192 ≈ 2 days at 15 min)
#   BACKUP_OFFSITE_CMD optional shell command run with the dump path as $1
#                      (e.g. "aws s3 cp \"$1\" s3://delphic-backups/")
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BACKUP_DIR="${ROOT}/backups"
BACKUP_KEEP="${BACKUP_KEEP:-192}"
DC="docker compose -f docker-compose.yml -f docker-compose.prod.yml"
PG_USER="${POSTGRES_USER:-postgres}"
PG_DB="${POSTGRES_DB:-requirement_dashboard}"

log() { printf '%s %s\n' "$(date +'%F %T')" "$*"; }

if ! $DC exec -T db pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
  log "ERROR: Postgres not ready — no backup taken."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="${BACKUP_DIR}/auto-$(date +%Y-%m-%d-%H%M%S).dump"

if ! $DC exec -T db pg_dump -U "$PG_USER" -Fc "$PG_DB" > "$OUT"; then
  log "ERROR: pg_dump failed — removing partial file."
  rm -f "$OUT"
  exit 1
fi

# Verify it is restorable (inside the container, which always has a matching pg_restore).
if ! $DC exec -T db sh -c 'cat > /tmp/verify.dump && pg_restore --list /tmp/verify.dump >/dev/null && rm -f /tmp/verify.dump' < "$OUT"; then
  log "ERROR: backup $OUT failed pg_restore --list verification."
  exit 1
fi

SIZE="$(wc -c < "$OUT" | tr -d ' ')"
log "OK: $OUT ($SIZE bytes)"

if [ -n "${BACKUP_OFFSITE_CMD:-}" ]; then
  if bash -c "$BACKUP_OFFSITE_CMD" _ "$OUT"; then
    log "OK: copied offsite via BACKUP_OFFSITE_CMD"
  else
    log "WARN: offsite copy command failed for $OUT"
  fi
fi

# Rotate: keep the newest $BACKUP_KEEP auto-*.dump files.
# shellcheck disable=SC2012
ls -1t "$BACKUP_DIR"/auto-*.dump 2>/dev/null | tail -n +"$((BACKUP_KEEP + 1))" | while read -r old; do
  rm -f "$old" && log "rotated out $(basename "$old")"
done
