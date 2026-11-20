# 0033. Versions are major.minor.patch with an automatic patch

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner

## Context

Bare commit hashes are poor version numbers.

## Options weighed

- Hand-bumped versions (easy to forget)
- Versions computed from commit messages (needs a strict message format)
- The patch is the number of commits since `major.minor` was last raised

## Decision

Versions are `major.minor.patch` with an automatic patch, the number of commits since `major.minor` was last raised in `package.json`. The patch restarts at zero with every new minor or major version. Each built commit gets a git tag.

## Consequences

Details in [deployment.md](../deployment.md).
