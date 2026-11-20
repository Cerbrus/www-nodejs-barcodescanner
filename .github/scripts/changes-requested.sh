#!/usr/bin/env bash
set -euo pipefail

PULL=${1:?}
REPO=${GITHUB_REPOSITORY:?}
OWNER=${GITHUB_REPOSITORY_OWNER:?}
BOT=${BOT:-github-actions[bot]}
OUTPUT=${GITHUB_OUTPUT:-/dev/null}
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
REMARKS=${REMARKS:-.git/changes-requested.md}
MARKER='<!-- issue-investigator revised -->'

list() {
    gh api --paginate "repos/$REPO/$1?per_page=100" | jq -s 'add // []'
}

finish() {
    echo "result=$1" >>"$OUTPUT"
    echo "$2" >>"$SUMMARY"
    exit 0
}

main() {
    local conversation reviews lines since with_review at_lines in_conversation count
    conversation=$(list "issues/$PULL/comments")
    reviews=$(list "pulls/$PULL/reviews")
    lines=$(list "pulls/$PULL/comments")

    since=$(jq -r --arg bot "$BOT" --arg marker "$MARKER" \
        '[.[] | select(.user.login == $bot) | select(.body | startswith($marker)) | .created_at] | last // ""' <<<"$conversation")

    with_review=$(jq --arg owner "$OWNER" --arg since "$since" \
        '[.[] | select(.user.login == $owner) | select(.state != "PENDING") | select((.body // "") != "") | select(.submitted_at > $since)]' <<<"$reviews")
    at_lines=$(jq --arg owner "$OWNER" --arg since "$since" \
        '[.[] | select(.user.login == $owner) | select(.created_at > $since)]' <<<"$lines")
    in_conversation=$(jq --arg owner "$OWNER" --arg since "$since" \
        '[.[] | select(.user.login == $owner) | select(.created_at > $since)]' <<<"$conversation")

    count=$(jq -n --argjson a "$with_review" --argjson b "$at_lines" --argjson c "$in_conversation" '($a + $b + $c) | length')
    if [ "$count" = 0 ]; then
        rm -f "$REMARKS"
        finish none "The owner asked nothing new on #$PULL; nothing to change."
    fi

    {
        echo "# What the owner asks to change in pull request #$PULL"
        echo
        echo "## With his review"
        echo
        jq -r '.[] | "\(.body)\n"' <<<"$with_review"
        echo "## At a line of the change"
        echo
        jq -r '.[] | "### `\(.path)`, line \(.line // .original_line // "unknown")\n\n\(.body)\n"' <<<"$at_lines"
        echo "## In the conversation"
        echo
        jq -r '.[] | "\(.body)\n"' <<<"$in_conversation"
    } >"$REMARKS"
    finish asked "The owner wrote $count remarks on #$PULL since the last revision."
}

main "$@"
