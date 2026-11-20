# 0020. Sounds are built from blocks and kept as presets

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner
- Supersedes: [0017](0017-buzzer-sound-per-event.md)

## Context

The fixed library of [0017](0017-buzzer-sound-per-event.md) was too limited. Plan and options: [archive/sounds-plan.md](../archive/sounds-plan.md).

## Options weighed

- Keep the fixed list
- A speaker or passive buzzer for real tones (shelved)
- Blocks for the active buzzer

## Decision

Sounds are built from beep, pause, trill and buzz blocks for the active buzzer (no pitch), at most 1 second (halved from 2 by the owner on 2026-11-15) with as many blocks as fit in it (the cap of 12 dropped by the owner on 2026-11-15), kept as named presets in the database. The fixed list of sounds goes, the soft sounds included; a preset in use cannot be deleted. A speaker or passive buzzer for real tones is shelved.

## Consequences

The version announcement ([0019](0019-announce-only-higher-version.md)) picks a preset too.
