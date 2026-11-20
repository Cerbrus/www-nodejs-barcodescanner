# 0068. The Feedback page shows the progress of a sent remark, read from the GitHub API

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner (issue #38)

## Context

Nothing to store, and the state cannot go stale in the database.

## Options weighed

- A webhook and a table
- Read from the GitHub API by the server

## Decision

The Feedback page shows the state of the issue on GitHub and the pull request's number and title, read from the GitHub API by the server and cached for a minute. No webhook and no table.

## Consequences

None recorded.
