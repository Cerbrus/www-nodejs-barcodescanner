# 0081. Offline list: a snapshot and an outbox, the server wins on conflict

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/architecture.md` (Web app), [archive/offline-plan.md](../archive/offline-plan.md).

## Options weighed

Not recorded.

## Decision

Without a connection the list is shown from a snapshot of the last loaded data, kept in the browser's storage and removed at logout. Checking off, putting back, quantity and note also work offline, through an outbox with the moment of each change, sent in order to `POST /api/v1/list/offline-changes`. The server applies a change unless that list entry was changed on the server after the change was made; then the server's state stays. Scanning, naming, creating and removing products need a connection.

## Consequences

Builds on [0014](0014-online-first.md) and [0057](0057-list-entry-ids-and-variants.md). The service worker keeps the app's files and never API answers; the page reloads itself after an update.
