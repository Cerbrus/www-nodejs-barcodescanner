# 0125. A recipe row keeps its ingredient line, and a recipe reads as ingredients and description in one text

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

A recipe row says what to buy: a product, a quantity and a note ([0105](0105-recipe-tables-and-routes.md)). A recipe page on the web says what to cook with: "308 g Oreo-koekjes". The import ([0122](0122-recipes-imported-with-gemini.md)) turned the second into the first and wrote the original lines into the description, under a heading, as the model copied them. That made it hard to see what each row was made from, and the lines sat between the steps in a text the owner also edits. Markdown has nothing that folds open and shut; the app's renderer shows HTML as plain text on purpose.

## Options weighed

- **One text per row**: each row keeps the line it came from.
- **One block per recipe**: the whole list as a field beside the description, which the page can fold.
- **In the description, with a part that folds**: the renderer learns to let `details` and `summary` through.
- **As it was**: in the description under a heading.
- **The read view**: the lines and the products as one list, as two lists, or the lines only.

## Decision

**A row has a text of its own**: the ingredient line, at most 200 characters, plain text. The import fills it with the line of the recipe. A row made by hand has none until the owner types one.

**Reading a recipe** shows one text: a heading "Ingredients" in the language of the app, a line per row, and under it the description as it was typed or imported. A row without a text shows its product: the name, the note, and the quantity when it is above one, as `Eieren ×2`. The two parts look like one text. A row whose product is a draft has a warning sign behind its line ([0123](0123-draft-products.md)).

**The products are not shown when reading.** They are what goes on the list, and the tick sheet behind the button shows them. They show when editing.

**Editing a recipe** gives every product row a text field under it. Its placeholder is what the row shows without a text.

**The description of an import** holds the servings, the steps, what else the recipe says, and the link it came from. The ingredient lines are no longer in it.

**Rows that become one**, because they have the same product and the same note, keep both texts, joined with "; ". That happens in a save, and when a draft is replaced by a product the recipe already has ([0124](0124-replacing-a-draft-product.md)).

## Consequences

- The table of recipe rows gets a column, through a migration.
- A recipe code does not carry the texts ([0100](0100-recipes-as-qr-codes.md)): a recipe kept from a scanned code shows its products.
- A recipe that was imported before this still has the ingredient lines in its description and none on its rows. The owner imports it again.
- The line is what the model says the recipe gave; the app does not check it against the page.
