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
WAITING_FOR_APPROVAL=action_required

pull_of_issue() {
    gh pr list --repo "$REPO" --state open --json number,headRefName,headRefOid \
        --jq "map(select(.headRefName | startswith(\"issue/$ISSUE-\"))) | first // empty | \"\(.number) \(.headRefName) \(.headRefOid)\""
}

runs_for() {
    gh run list --repo "$REPO" --workflow "$WORKFLOW" --commit "$1" --limit 20 --json databaseId,conclusion \
        --jq ".[] | select(.conclusion $2 \"$WAITING_FOR_APPROVAL\") | .databaseId"
}

run_for() {
    runs_for "$1" '!=' | head -n 1
}

remove_runs_waiting_for_approval() {
    local run
    for run in $(runs_for "$1" '=='); do
        gh run delete "$run" --repo "$REPO" >/dev/null 2>&1 || true
    done
}

wait_for_run() {
    local sha=$1 attempts=$2 attempt run
    for ((attempt = 0; attempt < attempts; attempt++)); do
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

    run=$(wait_for_run "$sha" 3)
    if [ -z "$run" ]; then
        gh workflow run "$WORKFLOW" --repo "$REPO" --ref "$branch"
        run=$(wait_for_run "$sha" "$ATTEMPTS")
    fi
    remove_runs_waiting_for_approval "$sha"
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
