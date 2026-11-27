# 0128. The link a recipe came from is a field of its own

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner
- Changes one part of [0125](0125-ingredient-lines.md): the link is no longer in the description of an import

## Context

An import from a link wrote that link as the last line of the description, as a markdown link named after its site ([0125](0125-ingredient-lines.md)). The description is a text the owner edits, so the link could be changed or lost by accident, and the app could not tell a recipe with a source from one without.

## Options weighed

- **In the description**, as it was.
- **A field of its own** on the recipe, shown as a link when it is set.

## Decision

**A recipe has a source link**: one web address, starting with `http://` or `https://`, at most 2,000 characters, or nothing.

**The import fills it** with the link that was pasted. An import from pasted text without a link leaves it empty. The description no longer holds the link.

**Reading a recipe** shows the link under the description, named after its site, and it opens in a new tab. A recipe without one shows nothing in that place.

**The form** has a field for it. A text that is no web address cannot be saved.

## Consequences

- The `recipe` table gets a column `source_url`, through a migration. A recipe that was imported before keeps the link as the last line of its description and has no source link. The owner imports it again.
- A request that saves a recipe may leave the link out: a new recipe then has none and a changed one keeps what it had, as with the category ([0127](0127-recipe-categories.md)).
- A recipe code does not carry the link ([0100](0100-recipes-as-qr-codes.md)).
- The app does not check that the address exists or still holds the recipe.
