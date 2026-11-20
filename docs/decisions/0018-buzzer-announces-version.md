# 0018. The buzzer announces a new version once it is live

- Status: superseded by [0019](0019-announce-only-higher-version.md)
- Date: 2026-11-15
- Decided by: the owner (his wish)

## Context

The owner wanted to hear that an update arrived.

## Options weighed

Not recorded.

## Decision

The buzzer announces a new version once it is live, with a sound chosen like the scan sounds. The app keeps the highest version it announced in `data/announced-version`. Any version other than the last announced one played the sound.

## Consequences

A rollback played the sound too. Changed by [0019](0019-announce-only-higher-version.md).
