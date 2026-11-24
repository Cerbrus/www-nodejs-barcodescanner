#!/usr/bin/env bash
set -euo pipefail

REPO=${GITHUB_REPOSITORY:?}
BUILD_WORKFLOW=${BUILD_WORKFLOW:-.github/workflows/build.yml}
DRY_RUN=${DRY_RUN:-}
AGENT_BRANCH='^issue/([0-9]+)-'
FROM_FILES='^(area: .+|migration|no deploy|lands by hand)$'
FROM_ISSUE='^(bug|enhancement|complexity: .+|severity: .+)$'
# shellcheck disable=SC2016
CLOSING_ISSUE='query($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
            closingIssuesReferences(first: 1) { nodes { number } }
        }
    }
}'

area_of() {
    case $1 in
        Dockerfile | */Dockerfile | deployment/*) echo 'area: deployment' ;;
        apps/product-api/*) echo 'area: api' ;;
        apps/product-front/*) echo 'area: web app' ;;
        apps/hardware-agent/*) echo 'area: hardware agent' ;;
        libs/shared/*) echo 'area: shared' ;;
        e2e/*) echo 'area: e2e' ;;
        .github/*) echo 'area: workflows' ;;
        docs/* | *.md) echo 'area: docs' ;;
        data/*) echo 'area: data' ;;
    esac
}

paths_without_build() {
    if [ ! -f "$BUILD_WORKFLOW" ]; then
        return
    fi
    sed -n '/paths-ignore:/,/^    [a-z_]*:/p' "$BUILD_WORKFLOW" | sed -n "s/^ *- '\(.*\)'\$/\1/p"
}

starts_no_build() {
    local file=$1 pattern
    while read -r pattern; do
        pattern=${pattern//\*\*/*}
        # shellcheck disable=SC2053
        if [[ $file == $pattern ]]; then
            return 0
        fi
    done < <(paths_without_build)
    return 1
}

labels_from_files() {
    local files=$1 same_repo=$2 file deploys=false
    if [ -z "$files" ]; then
        return
    fi
    while read -r file; do
        area_of "$file"
        case $file in
            apps/product-api/src/data/migrations/*) echo 'migration' ;;
            .github/workflows/*) echo 'lands by hand' ;;
        esac
        if ! starts_no_build "$file"; then
            deploys=true
        fi
    done <<<"$files"
    if [ "$same_repo" != true ]; then
        echo 'lands by hand'
    fi
    if [ "$deploys" = false ] && [ -n "$(paths_without_build)" ]; then
        echo 'no deploy'
    fi
}

issue_of() {
    local number=$1 branch=$2 issue
    issue=$(gh api graphql -F owner="${REPO%/*}" -F name="${REPO#*/}" -F number="$number" -f query="$CLOSING_ISSUE" \
        --jq '.data.repository.pullRequest.closingIssuesReferences.nodes[0].number // empty' || true)
    if [ -z "$issue" ] && [[ $branch =~ $AGENT_BRANCH ]]; then
        issue=${BASH_REMATCH[1]}
    fi
    echo "$issue"
}

labels_of() {
    gh api "repos/$REPO/issues/$1" --jq '.labels[].name'
}

add_label() {
    echo "#$1 + $2"
    if [ -z "$DRY_RUN" ]; then
        gh api "repos/$REPO/issues/$1/labels" --silent -f "labels[]=$2"
    fi
}

remove_label() {
    echo "#$1 - $2"
    if [ -z "$DRY_RUN" ]; then
        gh api -X DELETE "repos/$REPO/issues/$1/labels/$(jq -rn --arg label "$2" '$label | @uri')" --silent
    fi
}

label_pull() {
    local number=$1 pull branch same_repo files issue wanted current owned='' label
    pull=$(gh api "repos/$REPO/pulls/$number")
    branch=$(jq -r .head.ref <<<"$pull")
    same_repo=$(jq -r '.head.repo.full_name == .base.repo.full_name' <<<"$pull")
    files=$(gh api --paginate "repos/$REPO/pulls/$number/files?per_page=100" --jq '.[].filename')

    if [ -n "$files" ]; then
        owned=$FROM_FILES
    fi
    wanted=$(labels_from_files "$files" "$same_repo")
    issue=$(issue_of "$number" "$branch")
    if [ -n "$issue" ]; then
        owned="${owned:+$owned|}$FROM_ISSUE"
        wanted+=$'\n'$(labels_of "$issue" | grep -E "$FROM_ISSUE" || true)
    fi
    wanted=$(sort -u <<<"$wanted" | sed '/^$/d')
    current=$(labels_of "$number")

    while read -r label; do
        if [ -n "$label" ] && ! grep -Fxq -- "$label" <<<"$current"; then
            add_label "$number" "$label"
        fi
    done <<<"$wanted"
    while read -r label; do
        if [ -n "$label" ] && ! grep -Fxq -- "$label" <<<"$wanted"; then
            remove_label "$number" "$label"
        fi
    done < <(grep -E "${owned:-^$}" <<<"$current" || true)
}

main() {
    local number
    for number in "$@"; do
        label_pull "$number"
    done
}

main "$@"
