# 0006. A repeat scan counts up, the same barcode within 3 seconds is ignored

- Status: superseded by [0007](0007-repeat-scan-1-second.md)
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Two empty cartons means buy two.

## Options weighed

Not recorded.

## Decision

Quantity counts up. The same barcode within 3 seconds is ignored.

## Consequences

Two cartons of the same product could not be scanned right after each other. Replaced by [0007](0007-repeat-scan-1-second.md).
