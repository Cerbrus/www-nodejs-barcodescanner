# 0076. The agent starts for any issue the owner labels

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner
- Supersedes: [0075](0075-agent-implements-owner-issues.md)

## Context

Under [0075](0075-agent-implements-owner-issues.md) the issue had to be written by the owner's account too.

## Options weighed

Not recorded.

## Decision

The agent starts for any issue the owner labels, also one that someone else wrote. Setting the label is his approval of what the issue asked at that moment, so the agent works from the text as it was then, not from a later edit by its writer, and still counts only the owner's comments. The rest of [0075](0075-agent-implements-owner-issues.md) stands: implement unless a real question is open, a pull request ready for review, never merge.

## Consequences

The rules of the agent are in `.github/issue-investigator.md`.
