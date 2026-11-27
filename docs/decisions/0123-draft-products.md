# 0123. A product made by a recipe import is a draft, reviewed in the inbox

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

A recipe import ([0122](0122-recipes-imported-with-gemini.md)) meets ingredients the app has no product for. A recipe row can only point at a product. Deleting a product today also removes its rows from every recipe, without a word.

## Options weighed

- **Open rows**: the import opens the recipe in edit mode with the unmatched rows marked, and the owner picks, creates or removes each before saving.
- **Create the products**: the import makes the missing products itself.
- **Leave them out**: the rows are dropped and named in the description.

## Decision

**The import creates the missing products**, each marked as a draft. A draft works like any product at once: in the recipe, on the list, in the search.

**Review in the inbox, by the owner.** A draft waits in the inbox until it is reviewed: its name, section and icon can be changed, and confirming it makes it an ordinary product. Only the owner imports, so only the owner sees drafts in the inbox and reviews them.

**What a draft starts with.** The name and section come from the model. The icon is the one the seed file gives a product of that name; otherwise one the model picked from the existing icons, checked against the real files; otherwise the emoji the model gave; otherwise none ([0009](0009-own-icon-set.md)).

**A product that a recipe uses cannot be deleted, draft or not.** The delete is refused and says how many recipes use it. The way out is merging it into another product ([0124](0124-merge-products.md)) or taking it out of those recipes first.

## Consequences

- The product table gets a mark for drafts, through a migration.
- The inbox holds a third kind of item beside unnamed barcodes and unknown recipes. It is shown to the owner only, and only the owner's badge counts it.
- Merging products has to exist before the import does.
- Deleting a product no longer removes it from recipes without a word, which it did until now for every product.
