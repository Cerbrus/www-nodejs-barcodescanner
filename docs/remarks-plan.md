# Plan: remarks from inside the app (milestone 11)

Status: idea registered on 2026-11-14, not started. The questions at the end are for the owner; nothing is built before they are answered.

## The idea

The owner, in his own words: "I want to be able to provide feedback from within the app, to be registered as bug reports or feature requests. Touch hold to open on an element, or right click or under the settings page."

So: while using the app, point at the thing that is wrong or missing, say what, and have it land somewhere it can be worked from. Today that path is: remember it, open a chat, describe which page and which button.

## A name first

"Feedback" is taken in this code: it means the sounds at the scanner (`FeedbackService`, the `feedback_setting` table, `/api/v1/feedback/...`). This plan calls the new thing a **remark**, with a kind: bug or wish. Routes under `/api/v1/remarks`, a `remark` table, a "Remarks" page. The visible Dutch text can still say "Feedback".

## What a remark holds

Typed by the user:

- kind: bug or wish
- text

Added by the app, so the user does not have to describe where he was:

- the page (route) and the address
- what was pointed at, when it was opened from an element: the component it sits in, its visible text, a short path to it, and for a product tile or barcode the product or code behind it
- app version and commit
- device facts the console banner already collects: browser, viewport, installed or tab, language, appearance, online or not
- the account, the time
- state at that moment: connected or not, number of waiting changes, the last few messages shown on screen

Not in a first version: a screenshot. A page cannot take a picture of itself; libraries that redraw the page into an image are heavy, miss things, and need care under the content security policy. The pointed-at element plus the page usually says enough. Question 5 keeps the door open.

## Ways to open it

1. **Under settings.** A row on the System page, in the "This device" or "Account" group, for everyone: "Remark". Opens the sheet without an element. Always works; the fallback for the other two.
2. **Right click** on desktop: the app's own small menu with one entry, "Remark about this", in place of the browser's menu.
3. **Touch and hold** on the phone, about 0.6 seconds, then the same entry.

Touch and hold needs care, and is the part most likely to annoy:

- iOS Safari does not send a right-click event for a long touch; the app has to time the touch itself and cancel when the finger moves (scrolling) or lifts.
- iOS has its own long-touch behaviour: the callout on links and images, text selection in fields and paragraphs. The app must switch the callout off for tiles and buttons and must leave text fields alone.
- A long touch must not also count as a tap. On a list tile a tap checks the product off; holding it must open the remark and nothing else.
- No hover or other hint tells the user it exists. One line under the settings row explains it.

An alternative to holding, if it gets in the way: a "point at it" mode, switched on from the settings row or a small button, in which the next tap picks an element instead of using it. Costs one extra tap, cannot collide with normal use. Question 2.

## Where remarks go

Three options. They can be combined.

| | Where | For | Against |
|---|---|---|---|
| A | A table in the app's own database, with a page that lists them | Private. No outside service. Backed up with the rest. Works for every account. | The work happens elsewhere (GitHub, a chat), so someone has to carry it over |
| B | GitHub issues on the repository, made by the server with a token | Lands where the code is; labels bug and enhancement; Dependabot's reviewer and a chat session can read them | The repository is public: every remark, and anything in it, is world-readable. Needs a token with write access on the Pi. Fails when GitHub is unreachable |
| C | A first, B on the owner's request per remark | Private by default, public only what the owner sends on | Two places |

Recommendation: **C**. Remarks are stored on the Pi. The owner's Remarks page shows them, newest first, with kind and state (open, done). A button per remark makes a GitHub issue from it, after showing exactly what will be sent; account, device details and product names stay out unless the owner leaves them in. Other accounts can write remarks and see their own; only the owner sees all and can send one on or close it.

For working through them in a session: the owner says "work through the remarks", and they are read from the Pi over SSH or from the issues with `gh`.

## Sketch of the build

API:

- `remark` table: id, kind, text, state, page, target (JSON), context (JSON), account, created, closed, issue address. A migration.
- `RemarkService` (owner of the table) and `RemarkController`: `POST /remarks` for every account; `GET /remarks` gives the owner all and others their own; `PATCH /remarks/:id` (state) and `POST /remarks/:id/issue` owner only.
- Limits: text length, size of the context, a cap per account per hour.
- GitHub, when chosen: a setting for the token, read through `AppConfig`; a failure to reach GitHub never loses the remark.

Web app:

- A remark sheet: kind, text, a line saying what was pointed at, send.
- A directive on the shell that listens for right click and long touch, finds the nearest meaningful element (tile, button, row, field), and opens the sheet with it.
- A Remarks page for the owner (and a short "my remarks" for others), reached from the System page.
- Without a connection: kept in the browser and sent later, like list changes, or refused with a message. Question 6.
- Texts in Dutch and English.

Tests, as the project now requires: unit tests for the rules (what is kept of an element, what goes to GitHub), route tests with owner and other account, component tests for the sheet and the trigger, one end-to-end test: right click a tile, write a remark, find it on the Remarks page.

Docs: a use case, the architecture section, the settings table if a token is added, a decision entry for where remarks go.

Size: about the size of the owner-and-accounts work plus the System page rework together. The long touch is the uncertain part; it needs trying on the iPhone before the rest is polished.

## Questions for the owner

1. **Where do remarks go?** Only on the Pi (A), straight to GitHub issues (B), or on the Pi with "send to GitHub" per remark (C, recommended)? With B or C: the repository is public, is that acceptable for what you would write?
2. **Touch and hold, or a "point at it" mode, or both?** Holding is quickest but can collide with scrolling and with what iOS does on a long touch. Recommended: build holding, try it on the iPhone, keep the mode as fallback.
3. **Who may write remarks?** Every account (recommended), or only the owner?
4. **Do you want to be told?** A push notification to the owner when another account writes a remark: yes, no, or later.
5. **Screenshot?** Not in the first version (recommended), or worth the cost to you?
6. **Without a connection:** keep the remark and send it later (recommended), or only allow remarks while connected?
7. **Kinds:** bug and wish enough, or also a plain "note"?
8. **What happens after?** Should a remark be able to carry a short answer or a state such as "done in 1.1.45" that the writer sees in the app, or is open and done enough?
