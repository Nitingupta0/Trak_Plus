#!/usr/bin/env bash
# TrakPlus — auto-deploy from ECR on Lightsail.
#
# Polls ECR for the latest image tag and deploys if changed.
# Run via cron: */5 * * * * /opt/trakplus/deploy/auto-deploy.sh >> /var/log/trakplus-deploy.log 2>&1
#
# Prerequisites (one-time setup on the box):
#   - aws CLI v2 configured with credentials that can read ECR
#   - docker + docker compose plugin
#   - this repo cloned at /opt/trakplus
#   - deploy/.env.lightsail filled in (for runtime env vars)

set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYED_TAG_FILE="${REPO_ROOT}/.deployed_tag"
AWS_REGION="${AWS_REGION:-ap-south-1}"

# Source environment variables from .env.lightsail
if [ -f "${REPO_ROOT}/deploy/.env.lightsail" ]; then
  set -a
  source "${REPO_ROOT}/deploy/.env.lightsail"
  set +a
fi

ECR_BACKEND_URL="${ECR_BACKEND_URL:?Set ECR_BACKEND_URL (e.g. 123456789.dkr.ecr.ap-south-1.amazonaws.com/trakplus-backend)}"
ECR_FRONTEND_URL="${ECR_FRONTEND_URL:?Set ECR_FRONTEND_URL}"
COMPOSE_FILES="-f docker-compose.yml -f deploy/docker-compose.lightsail.yml -f deploy/docker-compose.ecr.yml"
LOG_PREFIX="[auto-deploy $(date '+%Y-%m-%d %H:%M:%S')]"

# ── Helpers ──────────────────────────────────────────────────────────────────
log() { echo "${LOG_PREFIX} $*"; }
die() { log "ERROR: $*"; exit 1; }

# ── 1. Get the latest image tag from ECR ─────────────────────────────────────
log "Checking ECR for latest images..."

# Login to ECR (token is valid for 12 hours)
aws ecr get-login-password --region "${AWS_REGION}" | \
  docker login --username AWS --password-stdin "${ECR_BACKEND_URL%%/*}" >/dev/null 2>&1 || \
  die "Failed to login to ECR"

# Get the most recent image tag for backend (sorted by image pushed time)
# We filter out 'latest' and sort by pushed date to find the newest SHA-tagged image
LATEST_BACKEND_TAG=$(aws ecr describe-images \
  --repository-name "${ECR_BACKEND_URL##*/}" \
  --region "${AWS_REGION}" \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageTags[0]' \
  --output text 2>/dev/null || echo "NONE")

LATEST_FRONTEND_TAG=$(aws ecr describe-images \
  --repository-name "${ECR_FRONTEND_URL##*/}" \
  --region "${AWS_REGION}" \
  --query 'sort_by(imageDetails,& imagePushedAt)[-1].imageTags[0]' \
  --output text 2>/dev/null || echo "NONE")

if [ "${LATEST_BACKEND_TAG}" = "NONE" ] || [ "${LATEST_BACKEND_TAG}" = "None" ]; then
  log "No images found in ECR backend repo. Skipping."
  exit 0
fi

if [ "${LATEST_FRONTEND_TAG}" = "NONE" ] || [ "${LATEST_FRONTEND_TAG}" = "None" ]; then
  log "No images found in ECR frontend repo. Skipping."
  exit 0
fi

log "Latest backend tag: ${LATEST_BACKEND_TAG}"
log "Latest frontend tag: ${LATEST_FRONTEND_TAG}"

# Use the backend tag as the canonical tag (both should be the same git SHA)
IMAGE_TAG="${LATEST_BACKEND_TAG}"

# ── 2. Compare with currently deployed tag ──────────────────────────────────
CURRENT_TAG=""
[ -f "${DEPLOYED_TAG_FILE}" ] && CURRENT_TAG=$(cat "${DEPLOYED_TAG_FILE}")

if [ "${IMAGE_TAG}" = "${CURRENT_TAG}" ]; then
  log "Already on tag ${IMAGE_TAG}. Nothing to do."
  exit 0
fi

log "New image detected: ${CURRENT_TAG:-<none>} -> ${IMAGE_TAG}"

# ── 3. Deploy ─────────────────────────────────────────────────────────────────
log "Pulling images..."
cd "${REPO_ROOT}"

# Export image URLs and tag for the compose override
export ECR_BACKEND_IMAGE="${ECR_BACKEND_URL}:${IMAGE_TAG}"
export ECR_FRONTEND_IMAGE="${ECR_FRONTEND_URL}:${IMAGE_TAG}"
export IMAGE_TAG

# Pull new images
docker compose ${COMPOSE_FILES} --env-file deploy/.env.lightsail pull || die "Failed to pull images"

log "Starting stack with new images..."
docker compose ${COMPOSE_FILES} --env-file deploy/.env.lightsail up -d --remove-orphans || die "Failed to start stack"

# Wait for health checks
log "Waiting for health checks..."
sleep 10

# Verify backend is healthy
HEALTH=$(curl -sf http://localhost:8000/health 2>/dev/null || echo '{"status":"fail"}')
if echo "${HEALTH}" | jq -e '.status == "ok"' >/dev/null 2>&1; then
  log "Health check passed."

  # Save the deployed tag
  echo "${IMAGE_TAG}" > "${DEPLOYED_TAG_FILE}"
  log "Deployed tag ${IMAGE_TAG} and saved to ${DEPLOYED_TAG_FILE}"
else
  log "WARNING: Health check failed after deploy. Health response: ${HEALTH}"
  log "Deployment may have issues. Check: cd ${REPO_ROOT} && docker compose logs"
  exit 1
fi

log "Deployment complete."
