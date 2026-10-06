#!/usr/bin/env bash
# TrakPlus — nightly Postgres backup (pg_dump) from the Lightsail box to S3.
#
# Install on the box (as the deploy user):
#   sudo crontab -e   (or: crontab -e)
#   # daily 02:30 UTC
#   30 2 * * * /opt/trakplus/deploy/backup.sh >> /var/log/trakplus-backup.log 2>&1
#
# Requires the aws CLI with credentials that can PutObject to the backup bucket
# (e.g. an instance profile or configured keys). Creates the bucket on first run.

set -euo pipefail

BACKUP_BUCKET="${BACKUP_BUCKET:-trakplus-backups}"
REGION="${REGION:-ap-south-1}"
COMPOSE_DIR="/opt/trakplus"
ENV_FILE="$COMPOSE_DIR/deploy/.env.lightsail"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
KEEP_LOCAL_DAYS="${KEEP_LOCAL_DAYS:-7}"

# Load DB credentials from the deploy env file (POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB).
# shellcheck disable=SC1091
source "$ENV_FILE"

echo "==> $(date -u) backing up Postgres to s3://$BACKUP_BUCKET/"
aws s3api head-bucket --bucket "$BACKUP_BUCKET" --region "$REGION" >/dev/null 2>&1 || {
  echo "    creating bucket $BACKUP_BUCKET"
  aws s3api create-bucket --bucket "$BACKUP_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
}

docker exec "$(docker compose -f "$COMPOSE_DIR/docker-compose.yml" \
  -f "$COMPOSE_DIR/deploy/docker-compose.lightsail.yml" \
  --env-file "$ENV_FILE" ps -q postgres)" \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  | aws s3 cp - "s3://$BACKUP_BUCKET/trakplus-$STAMP.dump"

echo "    uploaded trakplus-$STAMP.dump"

# Prune old local dumps (if any were kept) — we stream straight to S3, so nothing local.
echo "    done."
