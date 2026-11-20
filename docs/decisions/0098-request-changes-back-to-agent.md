# 0098. A request for changes sends the pull request back to the agent

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner (he asked how a remark on a pull request could start a change; the form of it was proposed to him)

## Context

The agent could be called again in three ways: the label `investigate` on the issue, a repair after failed checks and a rebase after a conflict. None of them read what the owner wrote on the pull request, and the agent's rules for the label did not say what to do with a pull request that was open already. A remark on a pull request started nothing.

## Options weighed

- A comment on the issue and the label again: reads no remarks at lines of the change
- A word in a comment on the pull request: a comment that only thinks out loud would start a run, or the word must be remembered
- A label on the pull request
- A review by the owner that requests changes

## Decision

A review by the owner's account that requests changes, on a pull request of the agent (branch `issue/<number>-...`), starts the investigator's workflow with the task `revise`. The same task can be started by hand. The workflow collects the owner's own words from the pull request, written since the agent's last revision, into a file: the text of his reviews, his remarks at lines and his comments in the conversation. The agent changes the pull request on the same branch and answers in one comment. A plain comment, or a review that only comments, starts nothing.

## Consequences

The agent's push moves the pull request past the review, so it lands only after a new approval, as [0060](0060-conflict-back-to-agent.md) already said for a request for changes. Each round is one run against the owner's Claude plan, with the one repair of [0077](0077-agent-repairs-failed-checks-once.md) when the checks fail after it. GitHub takes the workflow for a review from the branch of the pull request, so a pull request that was opened before this change must be on top of `master` first, or be sent by hand.
