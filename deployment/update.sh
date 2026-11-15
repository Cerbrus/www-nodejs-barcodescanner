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

exec 9>/run/lock/docker-update.lock
if ! flock -w 600 9; then
    echo "another updater on this machine held the Docker lock for ten minutes; trying again next time" >&2
    exit 0
fi

docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f >/dev/null

if [ -x firewall.sh ]; then
    ./firewall.sh
fi
