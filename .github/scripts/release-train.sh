#!/usr/bin/env bash
set -euo pipefail

REPO=${GITHUB_REPOSITORY:?}
OWNER=${GITHUB_REPOSITORY_OWNER:?}
BASE_BRANCH=${BASE_BRANCH:-master}
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
POLL_SECONDS=20
MERGED_ATTEMPTS=12

open_pulls() {
    gh api --paginate "repos/$REPO/pulls?state=open&base=$BASE_BRANCH&per_page=100" \
        --jq '.[] | select(.draft | not) | .number' | sort -n
}

approved_at() {
    local number=$1 head=$2 verdicts
    verdicts=$(gh api --paginate "repos/$REPO/pulls/$number/reviews?per_page=100" \
        --jq ".[] | select(.user.login == \"$OWNER\") | select(.state != \"COMMENTED\" and .state != \"PENDING\") | \"\(.state) \(.commit_id)\"")
    [ "$(tail -n 1 <<<"$verdicts")" = "APPROVED $head" ]
}

head_of() {
    gh api "repos/$REPO/pulls/$1" --jq .head.sha
}

comment_once() {
    local number=$1 marker=$2 text=$3 existing
    existing=$(gh api --paginate "repos/$REPO/issues/$number/comments?per_page=100" --jq '.[].body')
    if grep -qF -- "$marker" <<<"$existing"; then
        return
    fi
    gh api "repos/$REPO/issues/$number/comments" -f body="$marker
$text" --silent
}

leave_out() {
    local number=$1 head=$2 reason=$3
    echo "- #$number left out: $reason" >>"$SUMMARY"
    comment_once "$number" "<!-- release-train left-out $head -->" \
        "The release train left this pull request out: $reason ($RUN_URL)"
}

wait_for_approvals() {
    local minutes=${1:-0} deadline pending number
    case $minutes in
        '' | *[!0-9]*) minutes=0 ;;
    esac
    deadline=$(($(date +%s) + minutes * 60))

    while [ "$(date +%s)" -lt "$deadline" ]; do
        pending=0
        for number in $(open_pulls); do
            approved_at "$number" "$(head_of "$number")" || pending=$((pending + 1))
        done
        if [ "$pending" -eq 0 ]; then
            echo "Every open pull request is approved; the train leaves now."
            return
        fi
        echo "$pending open pull request(s) without approval; waiting."
        sleep "$POLL_SECONDS"
    done
}

candidates() {
    local requested=$1 open
    open=$(open_pulls)
    if [ -z "${requested//[^0-9]/}" ]; then
        echo "$open"
        return
    fi
    grep -oE '[0-9]+' <<<"$requested" | sort -nu | grep -Fxf <(echo "$open") || true
}

assemble() {
    local requested=${1:-} branch="release-train/run-${GITHUB_RUN_ID:?}"
    local base tip included='[]' number pull head head_branch same_repo files fork_point rebased count train

    git config user.name 'github-actions[bot]'
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
    git fetch --quiet origin "$BASE_BRANCH"
    base=$(git rev-parse FETCH_HEAD)
    tip=$base
    echo "## Release train" >>"$SUMMARY"

    for number in $(candidates "$requested"); do
        pull=$(gh api "repos/$REPO/pulls/$number")
        head=$(jq -r .head.sha <<<"$pull")
        head_branch=$(jq -r .head.ref <<<"$pull")
        same_repo=$(jq -r '.head.repo.full_name == .base.repo.full_name' <<<"$pull")

        if ! approved_at "$number" "$head"; then
            echo "- #$number skipped: not approved by $OWNER at its current commit" >>"$SUMMARY"
            continue
        fi
        if [ "$same_repo" != true ]; then
            leave_out "$number" "$head" "it comes from a fork, so its branch cannot be rebased here. Land it by hand."
            continue
        fi
        files=$(gh api --paginate "repos/$REPO/pulls/$number/files?per_page=100" --jq '.[].filename')
        if grep -q '^\.github/workflows/' <<<"$files"; then
            leave_out "$number" "$head" "it changes a workflow file, which the train's token may not push. Land it by hand."
            continue
        fi

        git fetch --quiet origin "refs/pull/$number/head"
        fork_point=$(git merge-base "$base" "$head")
        if git rebase --quiet --onto "$tip" "$fork_point" "$head" >/dev/null 2>&1; then
            rebased=$(git rev-parse HEAD)
        else
            git rebase --abort >/dev/null 2>&1 || true
            leave_out "$number" "$head" "it conflicts with \`$BASE_BRANCH\` or with a pull request ahead of it in the train. Rebase it and approve it again."
            continue
        fi
        if [ "$rebased" = "$tip" ]; then
            echo "- #$number skipped: it adds nothing to \`$BASE_BRANCH\`" >>"$SUMMARY"
            continue
        fi

        tip=$rebased
        included=$(jq -c --argjson number "$number" --arg head "$head" --arg branch "$head_branch" --arg rebased "$rebased" \
            '. + [{number: $number, head: $head, branch: $branch, rebased: $rebased}]' <<<"$included")
        echo "- #$number on board" >>"$SUMMARY"
    done

    count=$(jq length <<<"$included")
    if [ "$count" -gt 0 ]; then
        git push --quiet origin "$tip:refs/heads/$branch"
    else
        echo "No approved pull request to take along." >>"$SUMMARY"
    fi

    train=$(jq -cn --arg base "$base" --arg tip "$tip" --arg branch "$branch" --argjson pulls "$included" \
        '{base: $base, tip: $tip, branch: $branch, pulls: $pulls}')
    {
        echo "count=$count"
        echo "branch=$branch"
        echo "train=$train"
    } >>"${GITHUB_OUTPUT:?}"
}

set_branch() {
    gh api -X PATCH "repos/$REPO/git/refs/heads/$1" -f sha="$2" -F force=true --silent
}

restore_branches() {
    local train=$1 branch head
    while read -r branch head; do
        set_branch "$branch" "$head" || echo "::warning::Could not put $branch back to $head"
    done < <(jq -r '.pulls[] | "\(.branch) \(.head)"' <<<"$train")
}

finish_pull() {
    local number=$1 branch=$2 attempt issue
    for ((attempt = 0; attempt < MERGED_ATTEMPTS; attempt++)); do
        if [ "$(gh api "repos/$REPO/pulls/$number" --jq .merged)" = true ]; then
            for issue in $(gh pr view "$number" --repo "$REPO" --json closingIssuesReferences --jq '.closingIssuesReferences[].number'); do
                gh issue close "$issue" --repo "$REPO" >/dev/null || true
            done
            gh api -X DELETE "repos/$REPO/git/refs/heads/$branch" --silent || true
            echo "- #$number merged" >>"$SUMMARY"
            return
        fi
        sleep 5
    done
    echo "- #$number is on \`$BASE_BRANCH\`, but GitHub did not mark it as merged" >>"$SUMMARY"
    comment_once "$number" "<!-- release-train landed -->" \
        "The commits of this pull request are on \`$BASE_BRANCH\` through the release train, but GitHub did not mark it as merged. Close it by hand. ($RUN_URL)"
}

land() {
    local train=$1 base tip number head branch rebased
    base=$(jq -r .base <<<"$train")
    tip=$(jq -r .tip <<<"$train")

    if [ "$(gh api "repos/$REPO/git/ref/heads/$BASE_BRANCH" --jq .object.sha)" != "$base" ]; then
        echo "::error::$BASE_BRANCH moved while the train was checked. Nothing was merged; start the train again."
        exit 1
    fi
    while read -r number head; do
        if [ "$(gh api "repos/$REPO/pulls/$number" --jq '.state + " " + .head.sha')" != "open $head" ]; then
            echo "::error::#$number changed while the train was checked. Nothing was merged; start the train again."
            exit 1
        fi
    done < <(jq -r '.pulls[] | "\(.number) \(.head)"' <<<"$train")

    while read -r branch rebased; do
        set_branch "$branch" "$rebased"
    done < <(jq -r '.pulls[] | "\(.branch) \(.rebased)"' <<<"$train")

    if ! GH_TOKEN=${RELEASE_TRAIN_TOKEN:?} gh api -X PATCH "repos/$REPO/git/refs/heads/$BASE_BRANCH" -f sha="$tip" -F force=false --silent; then
        restore_branches "$train"
        echo "::error::Could not move $BASE_BRANCH to the train. Nothing was merged."
        exit 1
    fi

    echo "## Landed on \`$BASE_BRANCH\` as ${tip:0:7}" >>"$SUMMARY"
    while read -r number branch; do
        finish_pull "$number" "$branch"
    done < <(jq -r '.pulls[] | "\(.number) \(.branch)"' <<<"$train")
}

report_failure() {
    local train=$1 number
    for number in $(jq -r '.pulls[].number' <<<"$train"); do
        gh api "repos/$REPO/issues/$number/comments" --silent -f body="The release train stopped before it reached \`$BASE_BRANCH\`: $RUN_URL. Nothing was merged. This pull request rode along with $(jq -r '[.pulls[].number | "#\(.)"] | join(", ")' <<<"$train"); the checks ran on all of them together. It stays approved and goes with the next train."
    done
}

remove_branch() {
    gh api -X DELETE "repos/$REPO/git/refs/heads/$1" --silent || true
}

main() {
    local command=${1:?}
    shift
    case $command in
        wait) wait_for_approvals "$@" ;;
        assemble) assemble "$@" ;;
        land) land "$@" ;;
        report-failure) report_failure "$@" ;;
        remove-branch) remove_branch "$@" ;;
        *)
            echo "Unknown command: $command" >&2
            exit 2
            ;;
    esac
}

main "$@"
exit
