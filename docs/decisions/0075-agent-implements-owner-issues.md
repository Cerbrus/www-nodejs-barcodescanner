# 0075. The agent implements issues the owner wrote

- Status: superseded by [0076](0076-agent-for-any-labelled-issue.md)
- Date: 2026-11-15
- Decided by: the owner

## Context

The first four issues all ended in questions.

## Options weighed

Not recorded.

## Decision

An agent on GitHub handles an issue the owner labels. An issue from the owner is his decision and carries his authority, so the agent implements it in a pull request unless a real question is open, also when it overrules an earlier decision, and labels the issue with its verdict. It never merges. After its first pull request: the pull request is opened ready for review, not as a draft, and the owner is code owner of the whole repository. The issue had to be written by the owner's account too.

## Consequences

Changed by [0076](0076-agent-for-any-labelled-issue.md).
