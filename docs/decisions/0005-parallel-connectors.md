# 0005. Product lookup through parallel connectors

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

The user picks the name anyway, so there is no reason to stop at the first hit, and one broken connector does no harm.

## Options weighed

- Stop at the first hit
- Query every source and show every hit

## Decision

A list of connectors behind one interface, all queried in parallel, every hit shown as a suggestion. Start with Albert Heijn and Open Food Facts.

## Consequences

A connector failure never fails a scan, see [0080](0080-failures-never-fail-a-scan.md).
