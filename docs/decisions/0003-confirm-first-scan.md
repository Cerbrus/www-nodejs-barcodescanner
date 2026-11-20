# 0003. The user confirms the catalog item at the first scan of a barcode

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Generic names cannot be derived reliably from product titles.

## Options weighed

Not recorded.

## Decision

The user confirms the catalog item once; afterwards the barcode is handled automatically.

## Consequences

Every barcode asks for a name exactly once. Results of lookups are suggestions only, see [0005](0005-parallel-connectors.md).
