# 0080. A connector failure or a failed push never fails a scan

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md` hard rules.

## Options weighed

Not recorded.

## Decision

Supermarket APIs are unofficial: a connector failure must never fail a scan. The same goes for a failed push notification.

## Consequences

A failure is logged, and a connector failure is remembered on the barcode so the naming prompt can say which source gave no answer ([0005](0005-parallel-connectors.md), [0090](0090-lookup-in-background.md)).
