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

for script in update.sh firewall.sh backup.sh; do
    if curl -fsSL -o "$script.new" "$REPO_RAW/$script"; then
        chmod +x "$script.new"
        mv "$script.new" "$script"
    else
        rm -f "$script.new"
    fi
done

docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

if [ -x firewall.sh ]; then
    ./firewall.sh
fi
