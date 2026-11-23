# 0105. Recipe tables, routes, and how a recipe is kept in the scan history

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

Recipes are stored ([0101](0101-recipes-tab-and-pages.md)), go on the list as one history line with one undo, and an unknown recipe waits in the inbox ([0102](0102-putting-a-recipe-on-the-list.md)). The `scan` table has one row per scan with one product and the state its list entry had before; undo takes the latest row that is not undone. A table has one owning service ([0079](0079-one-thing-per-file-and-table-owner.md)).

## Options weighed

- **Ingredients**: their own table, or a JSON column on the recipe. With JSON, finding the recipes that use a product means reading every recipe, and ids of deleted products can stay behind.
- **A recipe in the history**: one `scan` row with a child table of changes, one `scan` row with the changes as JSON, or a table of its own next to `scan`. A table of its own splits the history and the "latest scan" of undo in two.
- **A waiting unknown recipe**: its own table, or a row in `recipe` with a flag. A flag has to be filtered in every query, clashes with the unique name when a stale code of an existing recipe comes in, and cannot hold a product id the app does not know.

## Decision

**Tables**, the first three owned by a new `RecipeService`:

| Table               | Columns                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `recipe`            | `id`, `name` (unique), `description`, `created_at`, `updated_at`                                                         |
| `recipe_ingredient` | `id`, `recipe_id`, `catalog_item_id`, `quantity`, `note`, `position`; product plus note is unique within a recipe        |
| `recipe_offer`      | `id`, `code` (the whole code, unique), `name`, `created_at`                                                              |
| `scan_change`       | one row per list entry a recipe scan touched: the scan, product, note, quantity added, and the state and quantity before |

A recipe that goes on the list is one row in `scan` with the result `recipe` or `recipe_partial` and the recipe's name in a new `title` column; its `scan_change` rows hold what undo restores. The source of a scan gets a third value, `app`, for a recipe added with a button. Scans of one product keep their columns as they are.

**Routes:**

| Method and path                                                             | Purpose                                                                                                                                                                    |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`, `POST /api/v1/recipes`, `GET`, `PATCH`, `DELETE /api/v1/recipes/:id` | Recipes with their ingredients                                                                                                                                             |
| `POST /api/v1/recipes/additions`                                            | Put the given ingredients of a recipe on the list as one history line, and save the recipe when asked. Used by the row button, the recipe page and the camera's tick sheet |
| `POST /api/v1/scans`                                                        | Unchanged for a barcode. A code that starts with `R1;` goes to the recipe rule and adds every product                                                                      |
| `GET /api/v1/barcodes?unmapped=true` or a route next to it                  | The inbox also returns the waiting recipe offers                                                                                                                           |

The web app writes the code text itself and reads a scanned code itself, with `libs/shared` ([0104](0104-shared-library.md)); no route hands out or explains a code.

## Consequences

- New migrations for the four tables and the `title` column; nothing in existing rows changes.
- Deleting a product removes it from the recipes that use it, after the confirmation of [0101](0101-recipes-tab-and-pages.md).
- An offer keeps the code as it was scanned, so a product id that was unknown then is still in it when the recipe is saved later.
