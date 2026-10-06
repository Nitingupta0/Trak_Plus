#!/usr/bin/env bash
# TrakPlus — provision a Lightsail instance + static IP for the single-box deploy.
#
# Usage:
#   deploy/provision.sh [--name trakplus] [--bundle small_3_1] [--blueprint ubuntu_24_04]
#                       [--az ap-south-1a] [--key my-key] [--region ap-south-1]
#
# Requires: aws CLI configured with AdministratorAccess (see docs/budget.md §5).
# Run this ONCE from your local machine. deploy.sh then deploys to the box.

set -euo pipefail

NAME="${NAME:-trakplus}"
BUNDLE="${BUNDLE:-small_3_1}"          # 2 vCPU / 2 GB / 60 GB SSD / 1.5 TB transfer — $12/mo
BLUEPRINT="${BLUEPRINT:-ubuntu_24_04}"
AZ="${AZ:-ap-south-1a}"
KEY_PAIR="${KEY_PAIR:-LightsailDefaultKeyPair}"
REGION="${REGION:-ap-south-1}"

echo "==> Creating Lightsail instance: $NAME ($BUNDLE / $BLUEPRINT) in $AZ"
aws lightsail create-instances \
  --instance-names "$NAME" \
  --availability-zone "$AZ" \
  --blueprint-id "$BLUEPRINT" \
  --bundle-id "$BUNDLE" \
  --key-pair-name "$KEY_PAIR" \
  --region "$REGION" >/dev/null

echo "==> Waiting for instance to reach 'running'..."
aws lightsail wait instance-running --instance-name "$NAME" --region "$REGION"

# --- Static IP (free while attached) ---
echo "==> Allocating + attaching static IP"
aws lightsail allocate-static-ip --static-ip-name "${NAME}-static" --region "$REGION" >/dev/null 2>&1 \
  || echo "    static IP already exists"
aws lightsail attach-static-ip --static-ip-name "${NAME}-static" --instance-name "$NAME" --region "$REGION" >/dev/null

# --- Firewall: open only 80/443 (22 is open by default for SSH) ---
echo "==> Opening ports 80 and 443"
aws lightsail open-instance-public-ports \
  --instance-name "$NAME" \
  --port-info fromPort=80,toPort=80,protocol=tcp \
  --region "$REGION" >/dev/null
aws lightsail open-instance-public-ports \
  --instance-name "$NAME" \
  --port-info fromPort=443,toPort=443,protocol=tcp \
  --region "$REGION" >/dev/null

PUBLIC_IP=$(aws lightsail get-static-ip --static-ip-name "${NAME}-static" --region "$REGION" \
  --query "staticIp.ipAddress" --output text)

echo ""
echo "=================================================================="
echo "  Lightsail instance ready:"
echo "    Instance: $NAME"
echo "    Static IP: $PUBLIC_IP"
echo "    SSH: ssh -i <key> ubuntu@$PUBLIC_IP"
echo ""
echo "  Next:"
echo "    export LIGHTSAIL_IP=$PUBLIC_IP"
echo "    cp deploy/.env.lightsail.example deploy/.env.lightsail   # fill in values"
echo "    deploy/deploy.sh"
echo "=================================================================="
