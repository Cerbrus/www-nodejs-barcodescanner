# 0048. Only the admin role may push to master

- Status: accepted
- Date: 2026-11-16
- Decided by: the owner
- Supersedes: [0047](0047-light-branch-protection.md)

## Context

The Dependabot reviewer installs proposed package versions while it holds a token that may write to the repository, and the Pi fetches and runs `update.sh` and `firewall.sh` from `master` every minute, so a malicious package release could otherwise reach the Pi through a push to `master`.

## Options weighed

- Light protection ([0047](0047-light-branch-protection.md))
- Only the admin role may push

## Decision

Only the repository's admin role may push to `master`; the ruleset got the rule against updates, with that role as the exception. Decided by the owner on 2026-11-16: the reviewer stays as it is and keeps running package code with its tokens present; that finding is dismissed.

## Consequences

Widened on 2026-11-20 by the release train token, see [0062](0062-train-token.md).
