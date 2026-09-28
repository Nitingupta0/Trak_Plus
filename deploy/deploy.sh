#!/usr/bin/env bash
# TrakPlus — deploy the Docker Compose stack to the Lightsail instance.
#
# Usage:
#   export LIGHTSAIL_IP=<ip>          # from provision.sh, or set manually
#   deploy/deploy.sh [--ssh-key ~/.ssh/id_rsa]
#
# Steps:
#   1. SSH into the box, install Docker + compose plugin.
#   2. Upload the repo (compose files, backend/, frontend/, deploy/) via rsync.
#   3. Upload deploy/.env.lightsail.
#   4. docker compose up -d --build.
#   5. Verify /health through Caddy.

set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
LIGHTSAIL_IP="${LIGHTSAIL_IP:?Set LIGHTSAIL_IP (from provision.sh) or export it}"
SSH_USER="${SSH_USER:-ubuntu}"
SSH_CMD="ssh -i $SSH_KEY -o StrictHostKeyChecking=accept-new"
REMOTE_DIR="/opt/trakplus"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> [1/5] Ensure Docker + compose plugin on $SSH_USER@$LIGHTSAIL_IP"
$SSH_CMD "$SSH_USER@$LIGHTSAIL_IP" 'bash -s' <<'REMOTE'
set -eux
command -v docker >/dev/null 2>&1 || {
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
}
docker compose version >/dev/null 2>&1 || {
  sudo apt-get update
  sudo apt-get install -y docker-compose-plugin
}
REMOTE

echo "==> [2/5] Upload repo to $REMOTE_DIR"
$SSH_CMD "$SSH_USER@$LIGHTSAIL_IP" "sudo mkdir -p $REMOTE_DIR && sudo chown -R $USER:$USER $REMOTE_DIR"
# tar-over-ssh: works everywhere (no rsync dependency), excludes heavy/secret dirs.
tar czf - \
  --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='.next' \
  --exclude='.terraform' --exclude='*.tfstate*' --exclude='deploy/.env.lightsail' \
  -C "$REPO_ROOT" backend frontend docker-compose.yml deploy \
| $SSH_CMD "$SSH_USER@$LIGHTSAIL_IP" "tar xzf - -C $REMOTE_DIR"

echo "==> [3/5] Upload deploy/.env.lightsail"
if [ ! -f "$REPO_ROOT/deploy/.env.lightsail" ]; then
  echo "!! deploy/.env.lightsail not found. Copy from .env.lightsail.example and fill it in."
  exit 1
fi
scp -i "$SSH_KEY" "$REPO_ROOT/deploy/.env.lightsail" "$SSH_USER@$LIGHTSAIL_IP:$REMOTE_DIR/deploy/.env.lightsail"

echo "==> [4/5] Build + start stack"
$SSH_CMD "$SSH_USER@$LIGHTSAIL_IP" "cd $REMOTE_DIR && docker compose -f docker-compose.yml -f deploy/docker-compose.lightsail.yml --env-file deploy/.env.lightsail up -d --build"

echo "==> [5/5] Verify /health via Caddy"
sleep 10
CADDY_SITE=$(grep -E '^CADDY_SITE_ADDRESS=' "$REPO_ROOT/deploy/.env.lightsail" | tail -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
if [ -z "$CADDY_SITE" ]; then
  CADDY_SITE="http://localhost"
fi
CURL_TLS_K=""
case "$CADDY_SITE" in
  https://*) CURL_TLS_K="-k" ;;
esac
$SSH_CMD "$SSH_USER@$LIGHTSAIL_IP" "curl -sf -L $CURL_TLS_K '$CADDY_SITE/health' | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d[\"status\"]==\"ok\", d; print(\"HEALTH OK:\", d)'"

echo ""
echo "Deployed. Browse to http://$LIGHTSAIL_IP (or your domain)."
echo "Logs: ssh -i $SSH_KEY ubuntu@$LIGHTSAIL_IP 'cd $REMOTE_DIR && docker compose logs -f'"
