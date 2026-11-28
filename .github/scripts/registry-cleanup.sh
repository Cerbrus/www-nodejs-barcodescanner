#!/usr/bin/env bash
set -euo pipefail

OWNER=${GITHUB_REPOSITORY_OWNER:?}
REGISTRY=${REGISTRY:-ghcr.io}
PACKAGES=${PACKAGES:-barcodescanner-app barcodescanner-agent}
KEEP_VERSIONS=${KEEP_VERSIONS:-10}
KEEP_TAGS=${KEEP_TAGS:-}
MIN_AGE_HOURS=${MIN_AGE_HOURS:-24}
DRY_RUN=${DRY_RUN:-true}
VERSION_TAG='^[0-9]+\.[0-9]+\.[0-9]+$'
ACCEPT='application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json'
FAILED=0

versions_of() {
    gh api --paginate "users/$OWNER/packages/container/$1/versions?per_page=100" --jq '.[]
        | [.id, .name, ([.created_at, .updated_at] | max | fromdateiso8601), (.metadata.container.tags | join(","))]
        | join(" ")'
}

pull_token() {
    curl -fsS "https://$REGISTRY/token?scope=repository:$1:pull" | jq -er .token
}

children_of() {
    curl -fsS -H "Authorization: Bearer $2" -H "Accept: $ACCEPT" "https://$REGISTRY/v2/$1/manifests/$3" \
        | jq -r '.manifests[]?.digest'
}

kept_tags_of() {
    local all_tags=$1
    echo latest
    tr ', ' '\n\n' <<< "$KEEP_TAGS" | sed '/^$/d'
    { grep -E "$VERSION_TAG" <<< "$all_tags" || true; } | sort -V | tail -n "$KEEP_VERSIONS"
}

clean_package() {
    local package=$1 repository token now id digest stamp tags tag child children all_tags wanted list
    local -A id_of=() tags_of=() stamp_of=() kept=()
    local -a queue=() order=() own_tags=()
    repository="${OWNER,,}/$package"
    token=$(pull_token "$repository")
    now=$(date +%s)
    list=$(versions_of "$package")

    while read -r id digest stamp tags; do
        id_of[$digest]=$id
        tags_of[$digest]=$tags
        stamp_of[$digest]=$stamp
        order+=("$digest")
    done <<< "$list"

    all_tags=$(printf '%s\n' "${tags_of[@]}" | tr ',' '\n' | sed '/^$/d')
    wanted=$(kept_tags_of "$all_tags")
    if ! grep -qx latest <<< "$all_tags"; then
        echo "$package: no version is tagged latest, nothing is removed" >&2
        return 1
    fi

    for digest in "${order[@]}"; do
        if [ $((now - stamp_of[$digest])) -lt $((MIN_AGE_HOURS * 3600)) ]; then
            kept[$digest]=1
            queue+=("$digest")
            continue
        fi
        IFS=, read -ra own_tags <<< "${tags_of[$digest]}"
        for tag in "${own_tags[@]}"; do
            if grep -qxF "$tag" <<< "$wanted"; then
                kept[$digest]=1
                queue+=("$digest")
                break
            fi
        done
    done

    while [ ${#queue[@]} -gt 0 ]; do
        digest=${queue[0]}
        queue=("${queue[@]:1}")
        children=$(children_of "$repository" "$token" "$digest")
        for child in $children; do
            if [ -z "${kept[$child]:-}" ]; then
                kept[$child]=1
                queue+=("$child")
            fi
        done
    done

    local removed=0
    for digest in "${order[@]}"; do
        if [ -n "${kept[$digest]:-}" ]; then
            continue
        fi
        removed=$((removed + 1))
        echo "$package: remove ${digest:7:12} ${tags_of[$digest]:-untagged}"
        if [ "$DRY_RUN" = false ]; then
            gh api -X DELETE "users/$OWNER/packages/container/$package/versions/${id_of[$digest]}" >/dev/null \
                || FAILED=$((FAILED + 1))
        fi
    done
    local outcome='would be removed'
    if [ "$DRY_RUN" = false ]; then
        outcome=removed
    fi
    echo "$package: ${#order[@]} versions, ${#kept[@]} kept, $removed $outcome"
}

for package in $PACKAGES; do
    clean_package "$package"
done

if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED versions could not be removed" >&2
    exit 1
fi
