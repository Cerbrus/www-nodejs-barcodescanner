# 0059. The owner's approval lands pull requests through a release train

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner

## Context

A pull request was finished and landed by hand. The owner's approval is the manual step, and it is also the selection.

## Options weighed

- GitHub's own merge queue (only for a repository owned by an organisation; moving the repository was weighed and dropped, because the image names, the workflows' owner checks and the Pi's settings would all change)
- A release train workflow

## Decision

Every pull request the owner approved at its current commit rides along. The release train rebases them onto `master` one after another, runs every check on the result and moves `master` to it, so several pull requests come out as one version.

- The train leaves when no open pull request is left without his approval, and at the latest 5 minutes after the approval that started it. A run by hand from the Actions page leaves at once and can be limited to chosen pull requests; those still need his approval.
- A pull request that conflicts with `master` or with one ahead of it drops out with a comment, and the others go on. When the checks on the whole train fail, nothing is merged and every pull request on it is told; they stay approved for the next train.
- Left out, to land by hand: a pull request from a fork, and one that changes a workflow file.
- The checks run twice, on the train and again in the build that follows the push. The first run keeps a failing combination off `master`; the second is the build that publishes.

## Consequences

Changes the line of 2026-11-15 that the owner lands the agent's pull requests himself. The agent still never merges. Related: [0060](0060-conflict-back-to-agent.md), [0061](0061-hot-box.md), [0062](0062-train-token.md), [0063](0063-train-railway-names.md).
