# 0115. Pull requests get their labels by themselves

- Status: accepted
- Date: 2026-11-25
- Decided by: the owner (he asked for automatic labels; the kinds, their names and the way they are set were proposed to him)

## Context

Pull requests of the agent carried no label at all, and those made by hand neither. The list of pull requests did not show what a pull request touches, how large or urgent its issue is, or why an approved one had not landed. The release train said the last in a comment only.

## Options weighed

- Which labels: the area from the changed paths; the kind and the estimate of the issue; flags for a migration, for a change that publishes no version and for one the train refuses; the state on the release train; a label per released version
- How they are set: a workflow on the pull request alone; the agent setting them; one script with several callers
- Whether the train keeps a label for an approved pull request that waits

## Decision

One script, `.github/scripts/pull-request-labels.sh`, sets and removes three kinds of labels: `area: ...` from the paths, the flags `migration`, `no deploy` and `lands by hand`, and the issue's `bug` or `enhancement`, `complexity: ...` and `severity: ...` ([0113](0113-agent-estimates-complexity-and-severity.md)). It touches no other label.

It has three callers, because a pull request that a workflow's token opens starts no other workflow: a workflow on the pull request itself, the investigator's workflow after the agent, and the release train for each pull request it looks at.

The release train sets `train: on board`, `train: left behind` and `train: derailed`, and removes them when the pull request boards again or lands. There is no label for waiting, since the train leaves on the approval, and none per released version, since that list would grow with every release.

## Consequences

The labels are made once by the owner. A label of these kinds that is removed by hand comes back at the next push. A merged pull request that GitHub shows without files keeps the area it had. The pull request that brings this changes workflow files, so the train refuses it and the owner lands it by hand.
