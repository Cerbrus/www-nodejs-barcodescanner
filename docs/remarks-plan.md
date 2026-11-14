# Plan: remarks from inside the app (milestone 11)

Status: idea registered on 2026-11-14; the owner answered the first round of questions on 2026-11-15. Not started. Three choices are still open, listed at the end.

## The idea

The owner, in his own words: "I want to be able to provide feedback from within the app, to be registered as bug reports or feature requests. Touch hold to open on an element, or right click or under the settings page."

So: while using the app, point at the thing that is wrong or missing, say what, and have it land somewhere it can be worked from. Today that path is: remember it, open a chat, describe which page and which button.

## A name first

"Feedback" is taken in this code: it means the sounds at the scanner (`FeedbackService`, the `feedback_setting` table, `/api/v1/feedback/...`). This plan calls the new thing a **remark**, with a kind: bug or wish. Routes under `/api/v1/remarks`, a `remark` table, a "Remarks" page. The visible Dutch text can still say "Feedback".

## What a remark holds

Typed by the user:

- kind: bug, wish or note
- text

Added by the app, so the user does not have to describe where he was:

- the page (route) and the address
- what was pointed at, when it was opened from an element: the component it sits in, its visible text, a short path to it, and for a product tile or barcode the product or code behind it
- app version and commit
- device facts the console banner already collects: browser, viewport, installed or tab, language, appearance, online or not
- the account, the time
- state at that moment: connected or not, number of waiting changes, the last few messages shown on screen

And a picture of the page, see "Screenshots".

## Ways to open it

Decided 2026-11-15: no touch and hold. It collides with scrolling, with the iPhone's own long-touch menu and text selection, and with the tap that checks a product off.

What stays:

1. **Under settings.** A row on the System page, for every account: "Remark". Opens the sheet without an element. Always works.
2. **Right click** on desktop: the app's own small menu with one entry, "Remark about this".

For the phone, in place of touch and hold, three candidates. Question A at the end asks which.

| | How | For | Against |
|---|---|---|---|
| a | **Pointing mode.** Started from the settings row ("Remark about a part of the app"). A bar at the top says "Tap what you mean" with a cancel button; the bottom tabs keep working, so the user can walk to the right page. The next tap on the content picks that element, outlines it, and opens the sheet. | Cannot collide with normal use. Works the same on every device. Easy to find. | Two or three taps before the remark |
| b | **Two-finger tap** anywhere: opens the sheet for what lies under the fingers. | One gesture, on the spot. The app has no other two-finger gesture; zooming is already off. | Nothing shows that it exists. Needs trying on the iPhone |
| c | **A small button on every page**, in the corner or next to the page title, that starts pointing mode. | Always in sight, one tap to start | Takes room on a small screen, on every page, for something used rarely |

Recommendation: **a and b together**. Pointing mode is the way everyone can find; the two-finger tap is the shortcut for the owner, and it simply starts the same sheet. If the two-finger tap misbehaves on the iPhone it is dropped and nothing else changes.

## Where remarks go

Decided 2026-11-15: **on the Pi, with "send to GitHub" per remark.**

- Remarks are stored in the app's database. Every account can write remarks and sees its own. The owner sees all of them.
- Only the owner can send a remark to GitHub. Before sending, the app shows exactly what will go out; account, device details and product names stay out unless the owner leaves them in. The repository is public, so this step is the privacy gate.
- Kinds: **bug**, **wish** and **note**. A note is for the owner's own memory and is never sent on by accident; it can be sent like the others.
- The writer gets a thank-you, nothing more: no promise, no state to follow. For the owner a remark is open or closed, and shows whether it was sent to GitHub, with a link.
- The owner is told about a remark from another account: a push notification, and a message on screen when the app is open.

### Issue templates

The repository gets issue forms under `.github/ISSUE_TEMPLATE/`: a bug report and a feature request, with the same headings the server uses when it makes an issue from a remark (what happened or what is wished, where in the app, version, device). Issues written by hand on GitHub and issues sent from the app then look alike, and the labels `bug` and `enhancement` are set by the form or by the server.

### The token

The server needs a GitHub token to make issues: a fine-grained personal access token of the owner, limited to this one repository, with read and write on issues only. It goes in the Pi's `.env` as a new setting and is read through `AppConfig`. Without it the "send to GitHub" button is not shown. The owner makes the token; it is never in the repository, the docs or an image.

## Screenshots

Decided 2026-11-15: wanted. Two ways to get one; question B asks which.

| | How | For | Against |
|---|---|---|---|
| 1 | **The app draws the page into a picture itself**, with a small library that copies the page's elements into an image | No extra step for the user | Not a real photo: fonts, product photos from other sites and some layout can come out wrong or missing, more so on the iPhone. Adds a library to the web app |
| 2 | **The user attaches a picture**: a button in the remark sheet opens the photo picker; on the iPhone that offers the screenshot just taken with the side buttons | A real picture of what the user saw, also of the iPhone's own dialogs | Two extra steps, and only when the user thinks of it |

Recommendation: **both**: the app tries to draw the page when the sheet opens and shows the result small in the sheet; the user can remove it or replace it with a picture of his own. If the drawing fails the sheet just has no picture.

Where pictures live:

- Shrunk in the browser before sending (longest side about 1600 pixels, JPEG, a size cap), then stored as files in the Pi's data folder, not in the database. The database dump that goes to the private backup repository every hour would otherwise grow with every picture.
- So pictures are **not in the backup**. Losing the Pi loses the pictures of old remarks, not the remarks.
- GitHub has no way for a program to attach a picture to an issue other than putting the file in a repository, and this repository is public. So a picture is **not sent to GitHub**; the issue says that a picture exists on the Pi. The owner can drag it into the issue by hand.

## Without a connection

Decided 2026-11-15: wanted. A remark written without a connection is kept in the browser, with its picture, and sent when the connection is back, like changes to the list. The sheet says "kept, will be sent later". Pictures are too big for the storage the list queue uses, so the remark queue gets its own store in the browser's database.

## An agent that looks at what is sent to GitHub

Asked by the owner on 2026-11-15: when a remark is sent to GitHub, an agent investigates it: how complex, whether it can be done, and for something small it starts a pull request.

How it can work, with the parts that already exist:

- A workflow like the Dependabot reviewer: `anthropics/claude-code-action` with the subscription token that is already a repository secret.
- It starts when an issue gets the label `investigate`. The server sets that label when the owner ticks "let the agent look at it" while sending; the owner can also set it by hand on any issue.
- **Step one, always:** read the issue and the code, and answer in a comment: what is asked, which parts of the code it touches, how big it is (small, medium, large, with the reason), whether anything in `docs/decisions.md` speaks against it, and what is unclear.
- **Step two, only when small and clear:** a branch and a **draft** pull request with the change, its tests and the docs, linked to the issue. The normal checks run on it. The agent never merges; `master` stays behind its ruleset; the owner reads and merges, or closes.
- For medium and large the comment is the result, with a proposed breakdown.

Guards, because the repository is public and anyone can open an issue there:

- The workflow runs only when the label was set by the owner's account, and only for issues the owner's account wrote (issues from the app are written with the owner's token, so they qualify). An issue or a label from anyone else starts nothing and costs nothing.
- The text of an issue is treated as a description of a wish, never as instructions to the agent. Text from other accounts in the house reaches GitHub only after the owner has read it and pressed send.
- One run per issue unless the owner asks again by removing and setting the label. A cap on steps and minutes per run, the smaller model for step one.
- The agent's workflow may write branches, pull requests and issue comments; it cannot push to `master`, publish images or read the Pi.

What it costs: each run counts against the owner's Claude plan, like the Dependabot reviews.

Question C asks how far the agent may go by itself.

## Sketch of the build

In this order, each step usable by itself:

1. **Remarks on the Pi.** The `remark` table (kind, text, state, page, target, context, account, created, closed, picture file, issue address) with a migration; `RemarkService` and `RemarkController`: `POST /remarks` for every account, `GET /remarks` gives the owner all and others their own, `PATCH /remarks/:id` owner only. Limits on text length, context size, picture size and remarks per account per hour. The remark sheet, the settings row, right click, and the Remarks page. Thank-you message. Push notification and on-screen message to the owner.
2. **Pointing on the phone**: pointing mode, and the two-finger tap if chosen.
3. **Screenshots**: the picture in the sheet, shrinking, storing as files, showing on the Remarks page.
4. **Without a connection**: the remark queue in the browser.
5. **GitHub**: issue forms in the repository, the token setting, the preview and "send to GitHub" for the owner.
6. **The agent**: the workflow and its instructions file, tried first on one hand-made issue.

Tests, as the project requires: unit tests for the rules (what is kept of an element, what goes to GitHub, the limits), route tests with owner and other account, component tests for the sheet, the pointing and the Remarks page, an end-to-end test (right click a tile, write a remark, find it on the Remarks page; write one without a connection and see it arrive), and the GitHub call tested against a stand-in server, never the real one.

Docs: use cases, the architecture section, the new settings, decision entries.

Size: steps 1 and 2 are about the size of the owner-and-accounts work plus the System page rework together. Steps 3 to 6 are each smaller, about the size of the reload-after-update work, except the agent, which is mostly instructions and guards and needs a careful first run.

## Answered by the owner on 2026-11-15

1. Where: on the Pi, with "send to GitHub". Also issue templates for bug reports and feature requests.
2. Touch and hold: dropped as impractical. Other ways asked for: see "Ways to open it".
3. Everyone may write remarks; only the owner can send to GitHub.
4. The owner is told: yes, with a message on screen.
5. Screenshots: wanted.
6. Without a connection: wanted.
7. Kinds: bug, wish and note.
8. Afterwards: no promise of when, just a thank-you.
9. New: an agent that investigates what is sent to GitHub and starts a pull request for small things.

## Still open

A. **Pointing on the phone**: pointing mode from the settings row plus a two-finger tap as shortcut (recommended), pointing mode only, or a small button on every page?

B. **Screenshots**: the app's own drawing plus the option to attach a real picture (recommended), only attach, or only the app's drawing? And is it acceptable that pictures stay on the Pi: not in the backup, not sent to GitHub?

C. **The agent**: may it open a draft pull request by itself for small things (as asked), or should it always stop after the comment until the owner says "go" on the issue? And should it run for every remark sent to GitHub, or only when ticked while sending (recommended)?

Needed from the owner before step 5: the GitHub token described under "The token".
