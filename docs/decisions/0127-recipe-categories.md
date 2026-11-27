# 0127. A recipe has one category from a fixed set, and the Recipes page groups by it

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

The Recipes page listed every recipe in one group, by name ([0101](0101-recipes-tab-and-pages.md)). With the import ([0122](0122-recipes-imported-with-gemini.md)) the number of recipes grows fast, and a dessert stood between two dinners. The owner asked for a category per recipe, such as dessert, soup, pie, cake or dinner. Later the recipes may become tiles with a picture, laid out like the shopping list with its sections.

## Options weighed

- **The set**: fixed in the code as the shop sections are ([0008](0008-fixed-shop-sections.md)), the owner's own with a page to manage them, or a fixed start the owner can add to.
- **How many**: one per recipe that may be left empty, one that every recipe has, or several.
- **The Recipes page**: groups under a heading per category, a row of buttons that narrows a flat list, or both.
- **The import**: the model proposes a category that the app checks, every import files under "other", or the owner confirms the proposal before the recipe is saved.
- **The size of the set**: the five the owner named plus "other", nine, or twelve.

## Decision

**A fixed set of nine**, in this order: breakfast, lunch, dinner, soup, salad, dessert, baking, snack, other. Baking holds cake, pie, cookies and bread. Each has a name in both languages and an icon.

**Every recipe has exactly one.** The form of a new recipe has no category picked, and saves only once one is. A recipe that existed before, and a recipe kept from a scanned code, is filed under "other".

**The Recipes page groups the recipes** under a heading per category, in the order of the set, by name within a group. A category without recipes is not shown. Above the groups is a row of buttons, one for all and one per category that has recipes, each with its icon only; a button narrows the page to that category, and the same button or the first one undoes it. The row is not there while every recipe has the same category. The search works across the groups and inside the chosen one.

**The import proposes the category.** The fixed set is in the question and in the shape of the answer. The app takes the answer only when it is one of the nine; anything else becomes "other". A category never fails an import. The owner changes it in the form.

## Consequences

- The `recipe` table gets a column `category`, a plain text with the id of the category, through a migration. There is no table of categories: the set lives in `libs/shared`, so a change to it needs no migration, only a recipe that has a removed id reads as "other".
- A request that saves a recipe may leave the category out: a new recipe then gets "other" and a changed one keeps what it had. That keeps a web app from before this decision working until it reloads.
- A recipe code does not carry the category ([0100](0100-recipes-as-qr-codes.md)).
- The icons of the categories join the list the font request names.
