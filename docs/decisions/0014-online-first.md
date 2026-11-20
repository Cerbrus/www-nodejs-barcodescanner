# 0014. Online first, offline later

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Sync is the largest single piece of work.

## Options weighed

Not recorded.

## Decision

Online first with an offline banner; the page reconnects and reloads by itself. Offline support is a later milestone.

## Consequences

The offline milestone was built on 2026-11-13 (plan in [archive/offline-plan.md](../archive/offline-plan.md)): the service worker keeps the app's files, never API answers, and the list works from a snapshot with an outbox. The choices of that plan were not recorded here at the time; see [0081](0081-offline-snapshot-and-outbox.md).
