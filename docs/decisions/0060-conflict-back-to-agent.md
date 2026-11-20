# 0060. A conflicting pull request of the agent goes back to the agent

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner (after pull request 43 conflicted with 42 in two lines of documentation)

## Context

Under [0059](0059-release-train.md) a conflicting pull request dropped out with a comment. The owner does not want to approve the same change twice.

## Options weighed

Not recorded.

## Decision

When it is a pull request of the agent, the train sends it back to the agent once it has arrived, the agent rebases it onto `master` and resolves the conflict, and it rides the next train without a new approval. An approval carries over a rebase by the agent. The workflow records that in a comment of its own on the pull request, and only such a comment counts, not one from anybody else.

## Consequences

A request for changes by the owner after it still stops the pull request. A push by anyone else after the approval, Dependabot bringing in a newer version included, still needs a new approval.
