# 0132. A product can be marked as always in the house, and a recipe then leaves it unticked

- Status: accepted
- Date: 2026-11-28
- Decided by: the owner

## Context

A recipe goes on the list as a whole, or through a sheet on which the user unticks what is in the house ([0102](0102-putting-a-recipe-on-the-list.md)). Some products are nearly always in the house: olive oil, salt, flour. The owner wants those unticked by default, so that a recipe does not put them on the list each time.

## Options weighed

- **Where the mark lives**: on the product, on the row of a recipe, or on the product with a row that can overrule it.
- **The word**: "always in the house", "pantry", "staple" or "in stock". Pantry reads as a place, staple as a kind of product, and in stock as a count the app does not keep.
- **The button on a recipe's tile**, which adds everything in one tap: it opens the tick sheet when the recipe holds such a product, it always opens the sheet, or it adds the rest at once and says what it left out.
- **The handheld scanner on a recipe code**, where there is no screen: leave such products out, or add everything.
- **The first filling**: by hand only, a list the owner approves once, or marks in the seed file.

## Decision

**A product has a mark "always in the house".** It is a tick box on the product's page, for every account, as products are shared. The mark counts in every recipe, old and new, and in a recipe that is scanned from a code.

**On the tick sheet a marked product starts unticked**, with a small sign on its row that says why. The user ticks it when the bottle is empty. This holds for the sheet of a recipe's own page and for the one the phone camera opens on a recipe code.

**The button on a recipe's tile opens the tick sheet when the recipe holds a marked product.** A recipe without one goes on the list at once, as before.

**The handheld scanner adds everything**, marked products too. The owner would rather see one too many on the list and take it off than miss one.

**The first filling** is a list of the owner's own products that the owner approves once; those are marked in the live database. The seed file then gets the same marks, for a fresh install.

## Consequences

- The `catalog_item` table gets a column `stocked`, through a migration. In the code the mark is called stocked.
- A request that changes a product may leave the mark out and then keeps what it had.
- A draft product is never on the list, marked or not ([0123](0123-draft-products.md)).
- A recipe added without a connection works the same: the sheet reads the products the app already holds.
- A recipe code does not carry the mark ([0100](0100-recipes-as-qr-codes.md)); it is read from the product at the moment of adding.
- Whoever marks a product changes it for every account.
