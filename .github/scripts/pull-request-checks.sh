#!/usr/bin/env bash
set -euo pipefail

ISSUE=${1:?}
REPO=${GITHUB_REPOSITORY:?}
OUTPUT=${GITHUB_OUTPUT:-/dev/null}
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
FAILED_LOG=${FAILED_LOG:-.git/checks-failed.md}
WORKFLOW=build.yml
ATTEMPTS=12
PAUSE_SECONDS=10

pull_of_issue() {
    gh pr list --repo "$REPO" --state open --json number,headRefName,headRefOid \
        --jq "map(select(.headRefName | startswith(\"issue/$ISSUE-\"))) | first // empty | \"\(.number) \(.headRefName) \(.headRefOid)\""
}

run_for() {
    gh run list --repo "$REPO" --workflow "$WORKFLOW" --commit "$1" --limit 1 --json databaseId --jq '.[0].databaseId // empty'
}

wait_for_run() {
    local sha=$1 attempt run
    for ((attempt = 0; attempt < ATTEMPTS; attempt++)); do
        run=$(run_for "$sha")
        if [ -n "$run" ]; then
            echo "$run"
            return
        fi
        sleep "$PAUSE_SECONDS"
    done
}

finish() {
    echo "result=$1" >>"$OUTPUT"
    echo "$2" >>"$SUMMARY"
    exit 0
}

main() {
    local pull number branch sha run
    pull=$(pull_of_issue)
    if [ -z "$pull" ]; then
        finish none "No open pull request for issue #$ISSUE; nothing to check."
    fi
    read -r number branch sha <<<"$pull"
    {
        echo "pull=$number"
        echo "branch=$branch"
    } >>"$OUTPUT"

    run=$(wait_for_run "$sha")
    if [ -z "$run" ]; then
        gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$branch"
        run=$(wait_for_run "$sha")
    fi
    if [ -z "$run" ]; then
        finish unknown "No build appeared for #$number at ${sha:0:7}."
    fi
    echo "run=$run" >>"$OUTPUT"

    if gh run watch "$run" --repo "$REPO" --exit-status --interval 30 >/dev/null 2>&1; then
        rm -f "$FAILED_LOG"
        finish passed "The checks pass for #$number at ${sha:0:7}."
    fi

    {
        echo "# The checks failed for pull request #$number at ${sha:0:7}"
        echo
        echo "Run: ${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/$run"
        echo
        echo "The last lines of the failed steps:"
        echo
        echo '```'
        gh run view "$run" --repo "$REPO" --log-failed 2>/dev/null | cut -f3- | tail -n 200 || true
        echo '```'
    } >"$FAILED_LOG"
    finish failed "The checks fail for #$number at ${sha:0:7}: run $run."
}

main "$@"
