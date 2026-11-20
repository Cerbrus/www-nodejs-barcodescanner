# 0062. The train moves master with a limited token of the owner's account

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner

## Context

Something must be allowed to move `master` for [0059](0059-release-train.md), while [0048](0048-only-admin-pushes-master.md) allows only the admin role.

## Options weighed

Not recorded.

## Decision

The train moves `master` with a token of the owner's account, limited to this repository, to its contents and its pull requests, and without the right to change workflow files. It is a secret of the environment `release`, which only runs from `master` can use, so a pull request cannot reach it; the job that runs the pull requests' code never gets it.

## Consequences

This widens what was narrowed on 2026-11-16: a stored secret can now write to `master`. Accepted, because nothing reaches `master` without the owner's approval of that exact commit.
