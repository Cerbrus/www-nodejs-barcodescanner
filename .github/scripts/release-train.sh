#!/usr/bin/env bash
set -euo pipefail

REPO=${GITHUB_REPOSITORY:?}
OWNER=${GITHUB_REPOSITORY_OWNER:?}
BASE_BRANCH=${BASE_BRANCH:-master}
RUN_URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/actions/runs/${GITHUB_RUN_ID:-0}"
PULLS_URL="${GITHUB_SERVER_URL:-https://github.com}/$REPO/pull"
SUMMARY=${GITHUB_STEP_SUMMARY:-/dev/null}
ART_URL="https://raw.githubusercontent.com/$REPO/$BASE_BRANCH/.github/release-train"
POLL_SECONDS=20
BOT='github-actions[bot]'
AGENT_BRANCH='^issue/([0-9]+)-'
MERGED_ATTEMPTS=12
LABELS_SCRIPT="$(dirname "${BASH_SOURCE[0]}")/pull-request-labels.sh"
STATE_LABELS=('train: on board' 'train: left behind' 'train: derailed')
UNSTARTED_BUILD_ATTEMPTS=6

open_pulls() {
    gh api --paginate "repos/$REPO/pulls?state=open&base=$BASE_BRANCH&per_page=100" \
        --jq '.[] | select(.draft | not) | .number' | sort -n
}

approved_at() {
    local number=$1 head=$2 verdicts verdict
    verdicts=$(gh api --paginate "repos/$REPO/pulls/$number/reviews?per_page=100" \
        --jq ".[] | select(.user.login == \"$OWNER\") | select(.state != \"COMMENTED\" and .state != \"PENDING\") | \"\(.state) \(.commit_id)\"")
    verdict=$(tail -n 1 <<<"$verdicts")
    if [ "$verdict" = "APPROVED $head" ]; then
        return 0
    fi
    [ "${verdict%% *}" = APPROVED ] && carried_to "$number" "$head"
}

carried_marker() {
    echo "<!-- release-train approval-carried $1 -->"
}

carried_to() {
    local number=$1 head=$2 notes
    notes=$(gh api --paginate "repos/$REPO/issues/$number/comments?per_page=100" \
        --jq ".[] | select(.user.login == \"$BOT\") | .body")
    grep -qF -- "$(carried_marker "$head")" <<<"$notes"
}

carry_approval() {
    local number=$1 before=$2 head
    head=$(head_of "$number")
    if [ "$head" = "$before" ]; then
        echo "#$number was not rebased; nothing to carry over."
        return
    fi
    if ! approved_at "$number" "$before"; then
        echo "#$number was not approved at ${before:0:7}; its rebase needs a look by $OWNER."
        return
    fi
    gh api "repos/$REPO/issues/$number/comments" --silent -f body="$(carried_marker "$head")
**🎫 Ticket still valid.** The agent rebased this pull request onto \`$BASE_BRANCH\` (\`${before:0:7}\` became \`${head:0:7}\`) and its checks pass, so the approval by $OWNER carries over. It rides the next train. ($RUN_URL)"
    echo "carried=true" >>"${GITHUB_OUTPUT:-/dev/null}"
}

head_of() {
    gh api "repos/$REPO/pulls/$1" --jq .head.sha
}

own_checks() {
    gh api "repos/$REPO/commits/$1/check-runs?per_page=100" \
        --jq '[.check_runs[] | select(.name == "checks")] | sort_by(.started_at) | last | .conclusion // empty'
}

pull_link() {
    echo "[#$1]($PULLS_URL/$1)"
}

picture() {
    echo "<img src=\"$ART_URL/$1.svg\" alt=\"$2\" width=\"480\">"
}

train_line() {
    local line='🚂' number
    for number in "$@"; do
        line+="-🚃#$number"
    done
    echo "$line"
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

set_state() {
    local number=$1 state=${2:-} label
    for label in "${STATE_LABELS[@]}"; do
        if [ "$label" = "train: $state" ]; then
            gh api "repos/$REPO/issues/$number/labels" --silent -f "labels[]=$label" ||
                echo "::warning::Could not label #$number as $label"
        else
            gh api -X DELETE "repos/$REPO/issues/$number/labels/$(jq -rn --arg label "$label" '$label | @uri')" --silent 2>/dev/null || true
        fi
    done
}

label_pull() {
    if [ -f "$LABELS_SCRIPT" ]; then
        bash "$LABELS_SCRIPT" "$1" || echo "::warning::Could not label #$1"
    fi
}

leave_out() {
    local number=$1 head=$2 title=$3 reason=$4 name=$5
    echo "- $title: $(pull_link "$number") ($name) $reason" >>"$SUMMARY"
    comment_once "$number" "<!-- release-train left-out $head -->" "$(picture left-on-the-platform 'A lone carriage left at the platform while the train leaves')

**$title.** The release train left without this pull request: it $reason ($RUN_URL)"
}

changes_workflow() {
    local files
    files=$(gh api --paginate "repos/$REPO/pulls/$1/files?per_page=100" --jq '.[].filename')
    grep -q '^\.github/workflows/' <<<"$files"
}

platform_state() {
    local number=$1 pull head
    pull=$(gh api "repos/$REPO/pulls/$number")
    head=$(jq -r .head.sha <<<"$pull")
    if [ "$(jq -r .user.login <<<"$pull")" = "$OWNER" ] ||
        [ "$(jq -r '.head.repo.full_name == .base.repo.full_name' <<<"$pull")" != true ] ||
        [ "$(own_checks "$head")" = failure ] ||
        changes_workflow "$number"; then
        echo stays
    elif approved_at "$number" "$head"; then
        echo ticket
    else
        echo waiting
    fi
}

wait_for_approvals() {
    local minutes=${1:-0} deadline tickets waiting number
    case $minutes in
        '' | *[!0-9]*) minutes=0 ;;
    esac
    deadline=$(($(date +%s) + minutes * 60))

    while [ "$(date +%s)" -lt "$deadline" ]; do
        tickets=0
        waiting=0
        for number in $(open_pulls); do
            case $(platform_state "$number") in
                ticket) tickets=$((tickets + 1)) ;;
                waiting) waiting=$((waiting + 1)) ;;
            esac
        done
        if [ "$tickets" -eq 0 ]; then
            echo "Nobody on the platform holds a ticket; the train does not wait."
            return
        fi
        if [ "$waiting" -eq 0 ]; then
            echo "Every pull request that can board has its ticket; the train leaves now."
            return
        fi
        echo "Last call: $waiting pull request(s) that can board without a ticket; waiting."
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
    local base tip included='[]' number pull name head head_branch same_repo fork_point rebased count train
    local -a aboard=() to_rebase=()
    local notes

    notes=$(mktemp)
    git config user.name 'github-actions[bot]'
    git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
    git fetch --quiet origin "$BASE_BRANCH"
    base=$(git rev-parse FETCH_HEAD)
    tip=$base

    for number in $(candidates "$requested"); do
        pull=$(gh api "repos/$REPO/pulls/$number")
        name=$(jq -r .title <<<"$pull")
        head=$(jq -r .head.sha <<<"$pull")
        head_branch=$(jq -r .head.ref <<<"$pull")
        same_repo=$(jq -r '.head.repo.full_name == .base.repo.full_name' <<<"$pull")
        label_pull "$number"

        if ! approved_at "$number" "$head"; then
            echo "- 🚫 No ticket: $(pull_link "$number") ($name) is not approved by $OWNER at its current commit" >>"$notes"
            continue
        fi
        if [ "$(own_checks "$head")" = failure ]; then
            SUMMARY=$notes leave_out "$number" "$head" '🔥 Hot box' "fails its own checks, so it would stop the whole train. It rides again once its checks pass." "$name"
            set_state "$number" 'left behind'
            continue
        fi
        if [ "$same_repo" != true ]; then
            SUMMARY=$notes leave_out "$number" "$head" '🛤️ Foreign rolling stock' "comes from a fork, so its branch cannot be rebased here. Land it by hand." "$name"
            continue
        fi
        if changes_workflow "$number"; then
            SUMMARY=$notes leave_out "$number" "$head" '📏 Wrong gauge' "changes a workflow file, which the train's token may not push. Land it by hand." "$name"
            continue
        fi

        git fetch --quiet origin "refs/pull/$number/head"
        fork_point=$(git merge-base "$base" "$head")
        if git rebase --quiet --onto "$tip" "$fork_point" "$head" >/dev/null 2>&1; then
            rebased=$(git rev-parse HEAD)
        else
            git rebase --abort >/dev/null 2>&1 || true
            if [[ $head_branch =~ $AGENT_BRANCH ]]; then
                to_rebase+=("${BASH_REMATCH[1]}")
                SUMMARY=$notes leave_out "$number" "$head" '🚧 Left on the platform' "conflicts with \`$BASE_BRANCH\` or with a carriage ahead of it. Rebasing luggage for the next train." "$name"
            else
                SUMMARY=$notes leave_out "$number" "$head" '🚧 Left on the platform' "conflicts with \`$BASE_BRANCH\` or with a carriage ahead of it. Rebase it and approve it again." "$name"
            fi
            set_state "$number" 'left behind'
            continue
        fi
        if [ "$rebased" = "$tip" ]; then
            echo "- 🧳 Travelling light: $(pull_link "$number") ($name) adds nothing to \`$BASE_BRANCH\`" >>"$notes"
            continue
        fi

        tip=$rebased
        aboard+=("$number")
        set_state "$number" 'on board'
        included=$(jq -c --argjson number "$number" --arg head "$head" --arg branch "$head_branch" --arg rebased "$rebased" \
            '. + [{number: $number, head: $head, branch: $branch, rebased: $rebased}]' <<<"$included")
        echo "- 🎟️ $(pull_link "$number") on board: $name" >>"$notes"
    done

    count=$(jq length <<<"$included")
    {
        if [ "$count" -gt 0 ]; then
            picture departing 'A steam locomotive pulling its carriages out'
            echo
            echo "## $(train_line "${aboard[@]}")"
            echo
            echo "**Full steam ahead.** The train left with $count pull request(s); the wheel-tapper checks them together before \`$BASE_BRANCH\` moves."
        else
            echo "## 💤 Empty platform"
            echo
            echo "No approved pull request to take along; the train stays in the shed."
        fi
        echo
        cat "$notes"
    } >>"$SUMMARY"
    rm -f "$notes"

    if [ "$count" -gt 0 ]; then
        git push --quiet origin "$tip:refs/heads/$branch"
    fi

    train=$(jq -cn --arg base "$base" --arg tip "$tip" --arg branch "$branch" --argjson pulls "$included" \
        '{base: $base, tip: $tip, branch: $branch, pulls: $pulls}')
    {
        echo "count=$count"
        echo "rebase=${to_rebase[*]:-}"
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

issues_of() {
    gh pr view "$1" --repo "$REPO" --json closingIssuesReferences --jq '.closingIssuesReferences[].number'
}

finish_pulls() {
    local attempt number issue
    local -a left=("$@") unmerged
    for ((attempt = 0; attempt < MERGED_ATTEMPTS && ${#left[@]}; attempt++)); do
        if [ "$attempt" -gt 0 ]; then
            sleep 5
        fi
        unmerged=()
        for number in "${left[@]}"; do
            if [ "$(gh api "repos/$REPO/pulls/$number" --jq .merged)" != true ]; then
                unmerged+=("$number")
                continue
            fi
            for issue in $(issues_of "$number"); do
                gh issue close "$issue" --repo "$REPO" >/dev/null 2>&1 || true
            done
            echo "- 🎟️ $(pull_link "$number") merged" >>"$SUMMARY"
        done
        left=("${unmerged[@]}")
    done
    for number in "${left[@]}"; do
        echo "- ⚠️ $(pull_link "$number") is on \`$BASE_BRANCH\`, but GitHub did not mark it as merged" >>"$SUMMARY"
        comment_once "$number" "<!-- release-train landed -->" \
            "**🚉 Arrived, but the ticket was not stamped.** The commits of this pull request are on \`$BASE_BRANCH\` through the release train, but GitHub did not mark it as merged. Close it by hand. ($RUN_URL)"
    done
}

unstarted_builds() {
    local sha=$1 run
    for run in $(gh api "repos/$REPO/actions/runs?head_sha=$sha&event=pull_request&status=completed&per_page=100" --jq '.workflow_runs[].id' || true); do
        if [ "$(gh api "repos/$REPO/actions/runs/$run/jobs" --jq .total_count || true)" = 0 ]; then
            echo "$run"
        fi
    done
}

remove_unstarted_builds() {
    local train=$1 attempt sha runs run
    local -a left missing
    mapfile -t left < <(jq -r '.pulls[].rebased' <<<"$train")
    for ((attempt = 0; attempt < UNSTARTED_BUILD_ATTEMPTS && ${#left[@]}; attempt++)); do
        if [ "$attempt" -gt 0 ]; then
            sleep 5
        fi
        missing=()
        for sha in "${left[@]}"; do
            runs=$(unstarted_builds "$sha")
            if [ -z "$runs" ]; then
                missing+=("$sha")
            fi
            for run in $runs; do
                gh api -X DELETE "repos/$REPO/actions/runs/$run" --silent || true
            done
        done
        left=("${missing[@]}")
    done
}

land() {
    local train=$1 base tip number head branch rebased
    local -a aboard=()
    base=$(jq -r .base <<<"$train")
    tip=$(jq -r .tip <<<"$train")

    if [ "$(gh api "repos/$REPO/git/ref/heads/$BASE_BRANCH" --jq .object.sha)" != "$base" ]; then
        echo "::error::The points changed under the train: $BASE_BRANCH moved while the train was checked. Nothing was merged; start the train again."
        exit 1
    fi
    while read -r number head; do
        aboard+=("$number")
        if [ "$(gh api "repos/$REPO/pulls/$number" --jq '.state + " " + .head.sha')" != "open $head" ]; then
            echo "::error::The points changed under the train: #$number changed while the train was checked. Nothing was merged; start the train again."
            exit 1
        fi
    done < <(jq -r '.pulls[] | "\(.number) \(.head)"' <<<"$train")

    while read -r branch rebased; do
        set_branch "$branch" "$rebased"
    done < <(jq -r '.pulls[] | "\(.branch) \(.rebased)"' <<<"$train")

    if ! GH_TOKEN=${RELEASE_TRAIN_TOKEN:?} gh api -X PATCH "repos/$REPO/git/refs/heads/$BASE_BRANCH" -f sha="$tip" -F force=false --silent; then
        restore_branches "$train"
        echo "::error::The signal stayed red: could not move $BASE_BRANCH to the train. Nothing was merged."
        exit 1
    fi

    {
        picture arrived 'The train standing at the platform of master station'
        echo
        echo "## $(train_line "${aboard[@]}")"
        echo
        echo "**🏁 Arrived on time**, as \`${tip:0:7}\`. \`$BASE_BRANCH\` moved, and the build that follows publishes one version for the whole train."
        echo
    } >>"$SUMMARY"
    finish_pulls "${aboard[@]}"
    for number in "${aboard[@]}"; do
        set_state "$number"
    done
}

report_failure() {
    local train=$1 number line
    local -a aboard=()
    for number in $(jq -r '.pulls[].number' <<<"$train"); do
        aboard+=("$number")
    done
    line=$(train_line "${aboard[@]}")
    for number in "${aboard[@]}"; do
        set_state "$number" derailed
        gh api "repos/$REPO/issues/$number/comments" --silent -f body="$(picture derailed 'A locomotive off the rails, nose in the ground')

$line

**🚨 Derailed.** The release train stopped before it reached \`$BASE_BRANCH\`: $RUN_URL. Nothing was merged. The checks ran on all carriages together, so the cause can be in any of them. This pull request stays approved and rides the next train."
    done
}

released_pulls() {
    local previous=$1 sha=$2 commit
    for commit in $(git rev-list "$previous..$sha"); do
        gh api "repos/$REPO/commits/$commit/pulls" \
            --jq ".[] | select(.merged_at != null and .base.ref == \"$BASE_BRANCH\") | .number" || true
    done | sort -nu
}

tell_released() {
    local number=$1 subject=$2 line=$3 tag=$4
    comment_once "$number" "<!-- release-train released $tag -->" "$(picture arrived 'The train standing at the platform of master station')

$line

**🏁 Arrived on time.** $subject is released as version [${tag#v}](${GITHUB_SERVER_URL:-https://github.com}/$REPO/releases/tag/$tag). The images are published, and the Pi installs them by itself within a few minutes." ||
        echo "::warning::Could not tell #$number about $tag"
}

announce() {
    local tag=${1:?} previous=${2:-} sha=${3:-${GITHUB_SHA:?}} line number issue
    local -a aboard=()
    if [ -z "$previous" ]; then
        echo "No earlier release to compare $tag with; nobody to tell."
        return
    fi
    for number in $(released_pulls "$previous" "$sha"); do
        aboard+=("$number")
    done
    if [ "${#aboard[@]}" -eq 0 ]; then
        echo "No pull request arrived with $tag."
        return
    fi
    line=$(train_line "${aboard[@]}")
    for number in "${aboard[@]}"; do
        tell_released "$number" 'This pull request' "$line" "$tag"
        for issue in $(issues_of "$number" || true); do
            tell_released "$issue" "Pull request #$number for this issue" "$line" "$tag"
        done
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
        carry-approval) carry_approval "$@" ;;
        announce) announce "$@" ;;
        remove-branch) remove_branch "$@" ;;
        remove-unstarted-builds) remove_unstarted_builds "$@" ;;
        *)
            echo "Unknown command: $command" >&2
            exit 2
            ;;
    esac
}

main "$@"
exit
