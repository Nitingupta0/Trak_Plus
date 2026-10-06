#!/usr/bin/env bash
# TrakPlus — tear down the Lightsail instance + static IP.
#
# Usage:
#   deploy/teardown.sh [--name trakplus] [--region ap-south-1]
#
# Destroys the instance and releases the static IP. Data on the EBS volume is lost.
# Run this from your local machine when you want to stop paying for Lightsail.
# Expects the aws CLI to be configured.

set -euo pipefail

NAME="${NAME:-trakplus}"
REGION="${REGION:-ap-south-1}"

echo "==> Deleting instance: $NAME"
aws lightsail delete-instance --instance-name "$NAME" --region "$REGION" >/dev/null

echo "==> Releasing static IP: ${NAME}-static"
aws lightsail release-static-ip --static-ip-name "${NAME}-static" --region "$REGION" >/dev/null 2>&1 || true

echo "Done. Lightsail resources cleaned up."