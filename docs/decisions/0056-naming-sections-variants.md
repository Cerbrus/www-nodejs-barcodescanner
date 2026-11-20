# 0056. Names, sections and variants of scanned products

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner

## Context

See [archive/naming-plan.md](../archive/naming-plan.md).

## Options weighed

- A language model making the suggestion (deferred until the rules prove too weak; only a free service counts, see the options in naming-plan.md)
- Rules

## Decision

Naming an unknown barcode offers the most specific existing product found in the shop title, else a more generic one with the rest as note, else a new name without brand and amount; the rules make that suggestion. That AI step is deferred (owner, 2026-11-15). A product can be on the list several times, told apart by its note, which is the variant; a barcode can carry that variant. The section of a new product comes from the shop's category first.

## Consequences

Built as [0057](0057-list-entry-ids-and-variants.md).
