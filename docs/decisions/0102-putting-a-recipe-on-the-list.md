# 0102. A recipe goes on the list at once or through a tick sheet, and counts as one line in the history

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

A recipe can reach the list in four ways: the handheld scanner reads its code, the phone camera reads its code, the button on its row of the Recipes page, and the button on its own page ([0100](0100-recipes-as-qr-codes.md), [0101](0101-recipes-tab-and-pages.md)). The handheld scanner has no screen. Some ingredients are often in the house already. The history has one line per scan, undo reverses the latest scan, and the buzzer plays one sound per scan result.

## Options weighed

- **In the app**: always add everything, always ask which products, or a fast way and a careful way next to each other.
- **The phone camera**: add everything at once with an undo toast, like a product scan, or ask first.
- **History**: one line per recipe or one line per ingredient. A line per ingredient makes twenty lines of one scan and takes twenty undos.
- **Sound**: reuse the sound of an added product, or events of its own.
- **An unknown product in a code**: with or without a push notification.

## Decision

**Fast and careful.** The handheld scanner and the button on a row of the Recipes page add every product at once; the app shows a toast with undo. The button on the recipe page and a recipe code read by the phone camera open a tick sheet: every product ticked, untick what is in the house, confirm. The camera pauses while the sheet is open and goes on after it. The sheet is built from the code, so it also works for a recipe the app does not know.

**Quantities.** A product that is already to buy goes up by the recipe's quantity, as if it were scanned that many times.

**History and undo.** A recipe is one line in the history, with its name, how many of its products were added and where it came from (handheld, phone or app). A tap shows the products and quantities. Undo, from the toast or the history, takes the whole recipe back in one step: every entry returns to the state and quantity it had.

**Sounds.** Two new events with their own default sound, both in the sound settings: `recipe` for a recipe that was added whole, and `recipe_partial` for one whose code held a product the app does not know.

**A product the app does not know.** The rest of the recipe is added. From the handheld scanner: the `recipe_partial` sound, a history line that says how many were added and how many are unknown, and a push notification. On the tick sheet: a greyed row with the product's id and its note, which cannot be ticked. It does not go to the inbox: there is nothing to name.

**A recipe the app does not know.** Its products go on the list as above, and the recipe becomes an item in the inbox, marked with the recipe icon and counted in the badge, with Save and Ignore. Save stores the recipe and opens it in edit mode. Ignore drops the item; the code keeps working and is offered again at its next scan. The same code scanned twice while it waits is one item. A recipe is known when one with the same name and the same products exists, so a stale code of an edited recipe is offered too, with a hint that a recipe of that name exists. The tick sheet has a box to save the recipe at once, which skips the inbox. No push notification for an unknown recipe.

## Consequences

- The camera page's frame becomes a square, so a QR code fits in it.
- The scan history holds a new kind of line, and undo has to restore several entries at once.
- The hardware agent and the sound settings learn two events.
