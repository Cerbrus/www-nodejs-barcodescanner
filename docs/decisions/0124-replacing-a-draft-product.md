# 0124. Only a draft product can be replaced by another product

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

A recipe import creates draft products ([0123](0123-draft-products.md)). A draft often turns out to be a product that already exists under another name, and a product that a recipe uses cannot be deleted. Merging products, folding a duplicate into another, was chosen for milestone 13 on 2026-11-15 and waits there.

A recipe's code carries the ids of its products ([0100](0100-recipes-as-qr-codes.md)), and codes are printed. Folding a product away makes its id unknown, so every printed code that holds it loses that product.

## Options weighed

- **Merge any product**, built before the import: a draft that is a duplicate is folded into the real product, and so can any other duplicate. It breaks printed codes of recipes that use the folded product.
- **Replace drafts only**: only a draft can be folded into another product, and a draft's id is kept off paper.
- **No merging**: a draft that is a duplicate is settled by hand, by changing each recipe row.

## Decision

**Only a draft can be replaced.** At its review, a draft is confirmed or replaced by an existing product. Replacing moves the rows of every recipe that uses the draft to the chosen product, and the draft is gone. When the recipe already has the chosen product with the same note, the quantities add up.

**A confirmed product is never folded into another.** One that a recipe uses can be neither deleted nor merged; the way out is taking it out of those recipes by hand.

**A draft's id stays off paper.** While a recipe holds a draft, its code is drawn with a large warning icon on it, and it cannot be printed.

## Consequences

- Merging products in general stays in milestone 13, with the printed codes as the obstacle to solve there.
- Replacing has only recipe rows to move: a draft has no list lines, barcodes or history lines ([0123](0123-draft-products.md)).
- A code of a recipe with a draft that was photographed or scanned from the screen loses that product once the draft is replaced.
