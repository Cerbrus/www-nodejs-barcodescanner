#!/usr/bin/env bash
set -euo pipefail

ISSUE=${1:?}
SINCE=${2:-}
REPO=${GITHUB_REPOSITORY:?}
OWNER=${GITHUB_REPOSITORY_OWNER:?}
AGENT=${AGENT_LOGIN:-claude[bot]}
DRY_RUN=${DRY_RUN:-}
MARKER='<!-- issue-investigator -->'
VERDICTS='implemented|needs answers|too large|not possible|not a bug'
OWNED='^(investigate|agent: .+|complexity: .+|severity: .+)$'

comment_of_agent() {
    gh api --paginate "repos/$REPO/issues/$ISSUE/comments?per_page=100" --jq \
        ".[] | select(.user.login == \"$AGENT\" and .created_at >= \"$SINCE\") | select(.body | startswith(\"$MARKER\")) | .body | @base64" |
        tail -n 1 | base64 -d | tr -d '\r'
}

verdict_in() {
    grep -A 1 -Fx '**Verdict:**' <<<"$1" | tail -n 1 | tr '[:upper:]' '[:lower:]' | sed 's/^ *//; s/[ .]*$//' || true
}

rating_in() {
    grep -ioE "^- $2 ($3)" <<<"$1" | head -n 1 | tr '[:upper:]' '[:lower:]' | sed "s/^- $2 //" || true
}

pull_of_issue() {
    gh pr list --repo "$REPO" --state open --json number,headRefName \
        --jq "map(select(.headRefName | startswith(\"issue/$ISSUE-\"))) | first | .number // empty"
}

change() {
    echo "$*"
    if [ -z "$DRY_RUN" ]; then
        gh api "$@" --silent
    fi
}

main() {
    local comment verdict complexity severity wanted current label target
    local -a add=()

    comment=$(comment_of_agent)
    if [ -z "$comment" ]; then
        echo "::error::The agent left no comment on issue #$ISSUE, so there is no verdict to set."
        exit 1
    fi
    verdict=$(verdict_in "$comment")
    if ! grep -qxE "$VERDICTS" <<<"$verdict"; then
        echo "::error::The comment on issue #$ISSUE has no verdict that is known: '$verdict'."
        exit 1
    fi
    complexity=$(rating_in "$comment" complexity 'small|medium|large')
    severity=$(rating_in "$comment" severity 'low|medium|high')

    wanted="agent: $verdict"
    if [ -n "$complexity" ]; then
        wanted+=$'\n'"complexity: $complexity"
    fi
    if [ -n "$severity" ]; then
        wanted+=$'\n'"severity: $severity"
    else
        echo "::warning::The comment on issue #$ISSUE gives no severity."
    fi
    if [ -z "$complexity" ] && [ "$verdict" != 'not possible' ] && [ "$verdict" != 'not a bug' ]; then
        echo "::warning::The comment on issue #$ISSUE gives no complexity."
    fi

    current=$(gh api "repos/$REPO/issues/$ISSUE" --jq '.labels[].name')
    while read -r label; do
        if ! grep -Fxq -- "$label" <<<"$current"; then
            add+=(-f "labels[]=$label")
        fi
    done <<<"$wanted"
    if [ "${#add[@]}" -gt 0 ]; then
        change "repos/$REPO/issues/$ISSUE/labels" "${add[@]}"
    fi
    while read -r label; do
        if [ -n "$label" ] && ! grep -Fxq -- "$label" <<<"$wanted"; then
            change -X DELETE "repos/$REPO/issues/$ISSUE/labels/$(jq -rn --arg label "$label" '$label | @uri')"
        fi
    done < <(grep -E "$OWNED" <<<"$current" || true)

    target=$ISSUE
    if [ "$verdict" = implemented ]; then
        target=$(pull_of_issue)
        target=${target:-$ISSUE}
    fi
    change "repos/$REPO/issues/$target/assignees" -f "assignees[]=$OWNER"
}

main
