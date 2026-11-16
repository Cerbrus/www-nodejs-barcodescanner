#!/usr/bin/env bash
# Pulls the current compose file and images and restarts what changed.
# Run by barcodescanner-update.timer every minute; safe to run by hand.
# Each run first asks the registry for the digest of every image and asks Compose
# what a restart would change. It stops there when the images on this machine are
# the registry's, Compose would leave every container running, and the compose
# file is unchanged.
set -euo pipefail

APP_DIR=/opt/barcodescanner
REPO_RAW=https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment
MANIFEST_TYPES=(
    application/vnd.oci.image.index.v1+json
    application/vnd.docker.distribution.manifest.list.v2+json
    application/vnd.oci.image.manifest.v1+json
    application/vnd.docker.distribution.manifest.v2+json
)

cd "$APP_DIR"

compose_changed=0
if curl -fsSL -o docker-compose.yml.new "$REPO_RAW/docker-compose.yml"; then
    if ! cmp -s docker-compose.yml.new docker-compose.yml; then
        compose_changed=1
    fi
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

remote_digest() {
    local image=$1 repository tag token accept=()
    repository=${image#ghcr.io/}
    tag=${repository##*:}
    repository=${repository%:*}
    token=$(curl -fsS "https://ghcr.io/token?scope=repository:$repository:pull" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    for type in "${MANIFEST_TYPES[@]}"; do
        accept+=(-H "Accept: $type")
    done
    curl -fsSI -H "Authorization: Bearer $token" "${accept[@]}" "https://ghcr.io/v2/$repository/manifests/$tag" |
        tr -d '\r' | sed -n 's/^docker-content-digest: *//Ip'
}

images_current() {
    local images image remote local_digests
    images=$(docker compose config --images 2>/dev/null) || return 1
    [ -n "$images" ] || return 1
    while read -r image; do
        [[ "$image" == ghcr.io/* ]] || return 1
        remote=$(remote_digest "$image" || true)
        local_digests=$(docker image inspect --format '{{join .RepoDigests " "}}' "$image" 2>/dev/null || true)
        if [ -z "$remote" ] || [[ " $local_digests " != *"@$remote "* ]]; then
            return 1
        fi
    done <<<"$images"
}

containers_current() {
    local plan
    plan=$(docker compose --ansi never --progress plain --dry-run up -d --remove-orphans 2>&1) || return 1
    [ -n "$plan" ] || return 1
    ! grep -qv ' Running *$' <<<"$plan"
}

if [ "$compose_changed" -eq 0 ] && images_current && containers_current; then
    exit 0
fi

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
