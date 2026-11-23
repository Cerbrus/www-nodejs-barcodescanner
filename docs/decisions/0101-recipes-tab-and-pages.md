# 0101. Recipes get their own tab; the Products page moves to the owner's part of System

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

Recipes are stored and managed in the app ([0100](0100-recipes-as-qr-codes.md)). The bottom menu has five tabs: List, Scan, Inbox, Products, System. The product page is one page for viewing and editing with a Save button.

## Options weighed

- **Where Products goes**: a row in a new group on the System page that every account sees, or a row in the owner's Management group.
- **Adding from the Recipes page**: a button on each row, or only from inside the recipe.
- **The recipe page**: one page that is always editable, like the product page, or a read view with an edit mode.

## Decision

**Menu.** Recipes takes the place of Products as the fourth tab, with the icon `menu_book`. Products becomes a row in the Management group of the System page, which only the owner sees. Only the page is closed to other accounts: making a product while naming a barcode or searching on the list stays open to every account.

**Recipes page.** A title, a search field that filters on the recipe's name, a button for a new recipe, and one row per recipe sorted by name. A row shows the name, the number of products and the icons of the first few. A tap on the row opens the recipe. A button on the row puts the recipe on the list.

**Select mode.** A toggle on the Recipes page gives every row a tick box and shows a Print button, which prints the codes of the ticked recipes ([0103](0103-recipe-codes-printed-on-a4.md)).

**Recipe page.** It opens as a read view: the name, the description, the products with quantity and note, the code, and buttons to put it on the list and to print it. A pencil button at the top right switches to edit mode: name, description, a row per product with quantity, note and remove, and the existing product search to add one; a product that does not exist can be made there. Save and Cancel leave edit mode. Delete sits in edit mode behind a confirmation. A new recipe starts in edit mode.

**Description.** A recipe has a description written in markdown, shown with the `marked` setup the remarks use. It is stored in the app only and is not in the code.

**The code** is shown in the read view only, so it always matches what is saved.

## Consequences

- This narrows [0045](0045-owner-and-other-accounts.md) for the Products page in the web app; the product routes of the API stay shared, because naming and the list search need them.
- A recipe saved from a scanned code starts without a description.
- Deleting a product that recipes use asks first, names how many recipes use it, and takes it out of those recipes on confirmation. A stored recipe therefore never points at a product that is gone; only a printed code can.
- Recipes are shared between accounts, like the list.
