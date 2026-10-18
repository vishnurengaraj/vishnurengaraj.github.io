#!/usr/bin/env bash
# Build the static site and rsync dist/ to the Raspberry Pi.
#
#   cp deploy.env.example deploy.env   # then edit
#   ./scripts/deploy.sh
#
# Or pass the destination inline:
#   DEPLOY_HOST=pi@rengaraj.local DEPLOY_PATH=/var/www/rengaraj ./scripts/deploy.sh

set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [[ -f deploy.env ]]; then
  # shellcheck disable=SC1091
  set -a
  source deploy.env
  set +a
fi

: "${DEPLOY_HOST:?Set DEPLOY_HOST, for example pi@192.168.1.20}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH, for example /var/www/rengaraj}"

npm run build

# Trailing slashes: copy the contents of dist/, and delete stale files on the Pi.
rsync -az --delete --human-readable \
  dist/ \
  "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "Published dist/ to ${DEPLOY_HOST}:${DEPLOY_PATH}/"
