# 0111. Buttons show an icon only, and each kind of action has one icon

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner

## Context

Most buttons showed an icon and a text. On a phone that made rows wrap, and the same action had different icons in different places: saving was a floppy disk on one page and a check on another, cancelling was a cross with or without the word. The owner went through every button with screenshots of each screen.

## Options weighed

- **Icon and text everywhere.** Clear, but wide, and the texts repeat what the place already says.
- **Icon only where the place makes the action clear, one icon per kind of action.** Narrow, and the icon can be learned once.

## Decision

A button shows its icon only. The text stays as the name a screen reader gets. One icon per kind of action:

| Action                               | Icon                              |
| ------------------------------------ | --------------------------------- |
| Save                                 | `save`                            |
| Delete                               | `delete`, red                     |
| Confirm                              | `check`, red when it deletes      |
| Cancel, back out of a form or a mode | `arrow_back`, left of the confirm |
| Close a popup                        | `close`                           |
| Undo                                 | `undo`                            |

Text stays where the icon cannot say it: a button that names what it makes ("New product ...", "New sound"), the count on the tick sheet of a recipe, "Later" and "Cancel scan" when naming a barcode, the kinds of a remark and of a sound block, "Test" for notifications, "Send to GitHub", the login button and the links back to the page above.

Every delete asks first, in the place of the row its button was in: the question, cancel on the left and the red check on the right. The one exception is the bin in the popup for a new remark, which throws away what was typed.

With it:

- The popup for a new remark no longer asks what to do with the text. It has three buttons: close and keep the text, close and clear it, and send. Escape and a click outside keep the text.
- The icon of a product is chosen by tapping the icon itself, which has a small pencil; the "Choose icon" button is gone.
- The language is chosen by flag, the theme by icon, with "Auto" written out.
- The explanations under notifications and feedback on the System page, under the note of a list entry and under the emoji of a product are gone. The text for blocked or unsupported notifications stays, because there is no button in that state.
- Cancelling a new product is `undo`: it takes back choosing to make one.

## Consequences

- An icon that is used must be in `icon-names.ts`; `verified` and `bottom_panel_close` were added.
- Tests find a button by its name for a screen reader, not by visible text.
- A flag is drawn by the device. Chrome on Windows shows the two letters of the country instead; the owner accepts that.
