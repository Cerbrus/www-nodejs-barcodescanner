# 0019. Only a version higher than the last announced one is announced

- Status: accepted
- Date: 2026-11-16
- Decided by: the owner (after the review)
- Supersedes: [0018](0018-buzzer-announces-version.md)

## Context

Under [0018](0018-buzzer-announces-version.md) any version other than the last announced one played the sound, also on a rollback.

## Options weighed

Not recorded.

## Decision

Only a version higher than the highest one announced is announced. A rollback, the way back from it and a first install stay silent. The app keeps that version in `data/announced-version`.

## Consequences

The sound itself is chosen like the scan sounds, see [0020](0020-sounds-from-building-blocks.md).
