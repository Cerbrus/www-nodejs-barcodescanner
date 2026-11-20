# 0100. A new version is taken into use without a page load

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner, issue #47

## Context

An open app reloaded the page when a newer web app was published (plan item 6, 2026-11-13; never written down as a record). On the iPhone the camera permission belongs to the loaded page, so after every new version the scan page asked for the camera again.

## Options weighed

- Keep the reload and postpone it for a day after the camera was used (pull request 49): rejected by the owner, he wants the code replaced while the page stays.
- Reload only at a cold start: an open app would keep running the old version.
- Replace the app inside the running document: chosen.

## Decision

A new version of the web app is taken into use inside the running page, without a page load.

- The page fetches the new start page and every script, chunk and style sheet it names, and only then destroys the running Angular app, swaps the styles and starts the new main script in the same document. Until everything is fetched and the new style sheets are loaded, the running app is untouched and the swap is tried again later, so the page never holds a mix of old and new files.
- It waits for the same moments as the reload did: a focused text field, an open dialog, the scan page. The camera is never stopped by an update.
- After a swap that worked, the fetched start page goes into the service worker's cache, so a start without a connection opens the new version.
- It falls back to one reload per published list when a swap is not possible (the start page names files that are not published, or its main script already ran in this page) or fails after the old app was destroyed.
- Services that live as long as the app release their timers, listeners and the event stream when the app is destroyed.

## Consequences

- A release that only changes the style sheet, and a rollback to a version this page ran before, still reload: a script with the same address does not start twice in one document.
- Only the styles, `app-root` and the scripts are replaced. A change to the rest of `index.html` (title, `meta` lines, the script that sets the theme) waits for the next real page load.
- The old version's modules stay in memory until the page is closed.
- Not tested on a real iPhone: whether the camera permission stays is the reason for this decision and is still to be seen there. Tested in headless Chrome by `e2e/update.e2e.ts`, with the service worker blocked, so the swap together with the service worker's cache was not tested in a browser.
