# 0112. Pulling a page down reloads it

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner

## Context

The app follows changes by itself through the live connection, but on a phone that connection can be asleep or lost, and the home-screen app has no reload button. The owner asked for pull down to refresh on the pages where it makes sense (issue 77, from the Feedback page).

## Options weighed

- **A reload button per page.** Takes room, and buttons are already icon only (0111).
- **Pull down on the content area, one reload per page, with a default.** Known from other phone apps; no new button.

## Decision

Pulling the content area down while it is scrolled to the top, past a threshold, reloads the page. The whole page moves down with the finger, and a spoked spinner like the one on iOS shows in the space it leaves, turning while the page is held down at that spot until the reload is done. The Material icon set has no such spinner, so it is drawn as an inline SVG of twelve spokes (the first version showed the `refresh` icon over the page, 2026-11-24, issue 83). The shell does this for every page. A page whose data does not come from the shopping store registers its own reload: Feedback and Scan history. Every other page reloads the store (list, inbox, recipes, products). A pull sends the changes that still wait for a connection first, as any reload does. It works by touch only; the desktop has the browser's reload.

## Consequences

- `PullRefreshService` holds the reload of the current page; `PullRefreshDirective` on the shell's content area detects the pull.
- A new page with its own data registers its reload with `PullRefreshService.use`.
- The System, Sounds, Log and What's new pages have nothing to reload beyond the store, which their pull does.
