#!/usr/bin/env bash
# Pulls the current compose file and images and restarts what changed.
# Run by barcodescanner-update.timer; safe to run by hand.
set -euo pipefail

APP_DIR=/opt/barcodescanner
REPO_RAW=https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment

cd "$APP_DIR"

if curl -fsSL -o docker-compose.yml.new "$REPO_RAW/docker-compose.yml"; then
    mv docker-compose.yml.new docker-compose.yml
else
    rm -f docker-compose.yml.new
    echo "could not fetch compose file, keeping the current one" >&2
fi

if curl -fsSL -o update.sh.new "$REPO_RAW/update.sh"; then
    chmod +x update.sh.new
    mv update.sh.new update.sh
else
    rm -f update.sh.new
fi

docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f >/dev/null
