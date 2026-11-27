# 0124. Merging products is built before the recipe import

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

Merging products, folding a duplicate into another, was chosen for milestone 13 on 2026-11-15 and waits there with the other parts. A recipe import creates draft products ([0123](0123-draft-products.md)). A draft often turns out to be a product that already exists under another name, and a draft that a recipe uses cannot be deleted.

## Options weighed

- **Leave it in milestone 13**: until then a draft that is a duplicate is settled by hand, by changing each recipe row and then deleting the draft.
- **Pull it forward**: build it as the first part of the recipe import.

## Decision

Merging products is pulled forward and built first. One product is folded into another: its barcodes, list lines, history and recipe rows move to the other product, and the folded product is gone. It is offered where a draft is reviewed and on the page of a product.

## Consequences

- The part gets its own plan before it is built, as every part of milestone 13 does. That plan settles what happens when both products are on the list with the same note or in one recipe with the same note, since a product with a note is unique in both ([0057](0057-list-entry-ids-and-variants.md)).
- Milestone 13 loses this part.
