# 0007. The repeat window is 1 second

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner
- Supersedes: [0006](0006-repeat-scan-3-seconds.md)

## Context

The window of 3 seconds in [0006](0006-repeat-scan-3-seconds.md) was too long: two cartons of the same product should be scannable right after each other.

## Options weighed

- Keep 3 seconds
- Lower it to 1 second

## Decision

Quantity counts up. The same barcode within 1 second is ignored (lowered from 3 seconds on 2026-11-12).

## Consequences

Two empty cartons scanned one after the other count as two.
