# Plan

How the prototype became the product, and what is left. Decisions behind this plan are in [decisions.md](decisions.md); how it works is in [architecture.md](architecture.md) and [deployment.md](deployment.md).

## Where it stands (2026-11-15, version 1.1.67)

In daily-use shape and running on the Pi:

- Handheld and camera scanning, the scan rules, inbox and naming, the list, product management, history with undo, the system log.
- Automatic updates from `master`, the firewall limit to the reverse proxy, an hourly database backup to a private repository. An open app reloads itself after an update. The Pi also runs the card scanner; the two updaters share a lock.
- Installable on the phone, Dutch and English, light and dark, push notifications for unknown handheld scans, shopping without a connection.
- Login with Google for an allowlist, with one owner account for the system parts. A buzzer at the scanner.
- Feedback from inside the app; the owner sends it to GitHub, where an agent implements it in a pull request, which is reviewed and landed locally. A "What's new" page built from the releases.
- Tests: API rules and routes, 263 web app tests, 11 browser tests, the hardware agent; all run before any image is published.
- Packages: Node 25, Nx 24, Angular 22, TypeScript 6. A content security policy in report-only mode.

## What comes next

Agreed with the owner on 2026-11-15:

1. **Names, sections and variants** (milestone 12), discussed with the owner on 2026-11-15: see [naming-plan.md](naming-plan.md). Includes the small leftovers: failed lookups on the history page, the eight emojis, the unused `source` field of the hardware agent.
2. **Rollback test** with `IMAGE_TAG`: two minutes on the Pi, and it proves the way back.
3. **The remaining package families** (see "Package upgrades"), one at a time, smallest first. Dependabot proposes the small ones weekly; #7 is open.
4. **Waiting on time or on the owner**: switch the content security policy to enforcing after a week of clean logs (from 2026-11-20); daily use, now mostly reported through the feedback button (milestone 6); the choices for other accounts and the invite system (milestone 10); the buzzer chain after a deploy, and Tera's answer on the beeper (milestone 7).
5. **Operations never tested** (list at the end).

Where it started: an API skeleton without a single endpoint that wrote a scan, a leftover poll app as frontend, a Python supermarket connector, PostgreSQL, and no commits.

## Milestones

Every "done" carries the date and time it was reached, local time, taken from the commit that completed it. Each milestone ends in something that runs. Milestones 1 and 2 removed the two biggest risks before any feature work.

### 0. Clean start: done 2026-11-12 14:46

- Deleted what the target does not need: the Python supermarket connector, `run.sh`, the root `docker-compose.yml`, `barcodes.txt`, run configurations of removed apps, unused supermarket packages.
- First commit and push; checked the Pi's architecture and Docker version.

### 1. Scanner spike on the Pi: done 2026-11-12 15:47

- Hardware agent with `evdev`: device path from `SCANNER_DEVICE`, exclusive grab, reopen loop, digits plus Enter become one scan.
- Runs on the Pi in an unprivileged container with the `/dev/input` mount and the cgroup rule.

Result: scans are logged, nothing reaches the Pi's console, the agent reconnects by itself after a replug and after a reboot. No host-service fallback needed. The scanner sometimes read one code twice within two seconds. The debounce was 3 seconds then and covered that; it is 1 second now, so a double read more than a second apart counts twice and needs an undo.

### 2. Pull-based deployment: done 2026-11-12 16:15

- Dockerfiles for `app` (multi-stage, Node slim) and `hardware-agent`.
- GitHub workflow: lint and tests, then both images for `linux/arm64`, pushed to `ghcr.io` with `latest`, version and commit-hash tags; the commit gets a `v<version>` git tag.
- `deployment/docker-compose.yml`, `install.sh`, `update.sh`, `firewall.sh`, the update timer and firewall service.
- Nginx Proxy Manager host with certificate and access list.

Result: a push to `master` reaches the Pi by itself, typically within ten minutes including the build. The app's port is limited to the reverse proxy's address.

### 3. Backend core: done 2026-11-12 16:53

- TypeORM on SQLite; plain modules `scan`, `catalog`, `list`, `connectors`, `events`, `log`; migrations; seed import on an empty database.
- Scan rules with debounce, count up, inbox and undo.
- Albert Heijn and Open Food Facts connectors behind one interface.
- Server-sent events; the hardware agent posts scans and its log lines.

Tests on 2026-11-13, after the restructure: 17 unit tests for the scan rules and session signing (`yarn product-api:test`), and 34 that run the real thing (`yarn product-api:test:integration`): the services against a temporary SQLite file, the login guard, the data routes and the whole app module over HTTP. The hardware agent has 20 tests of its own with a fake scanner, buzzer and API (`yarn hardware-agent:test`). Not covered by tests: the connectors' calls to the outside world, push sending, the web app. Verified by hand on the Pi: handheld scans reach the inbox, both connectors return suggestions, mapping a barcode applies its waiting scans, undo takes the last one back.

### 4. Frontend: done 2026-11-12 19:09

Pages: list, camera scan, inbox with naming prompt, products, product page with drawn barcodes (8, 12 and 13 digits), history with undo, log, System.

Reworked after two rounds of the user's feedback on iPhone and laptop:

- Red tiles to buy, green tiles recent, sections flowing on one line, quantity as a white pill.
- Collapsible product sections with tiles, a visual icon picker with the product's standard icon up front, autocomplete fields with clear buttons.
- Modal dialogs above the navigation; the camera pauses while the naming prompt is open.
- New products can be created from the list search as well as from the naming prompt.
- No double-tap zoom, a tap outside a text field closes the keyboard, sticky back links.
- System page: language, light and dark, notifications, status.
- App icon and name for the home screen, web app manifest, a console banner with debugging details.
- The page reconnects by itself after an update or a network drop and reloads its data.
- Minus at quantity 1 moves a product to recent; recent tiles have a menu to put it on the list, edit the product or remove it from recent. Logout is red and asks first.

Open question: the page once froze on the iPhone after an unknown camera scan. The likely cause, the camera decoding behind the dialog, is removed; it has not happened since, but it was never reproduced either.

### 5. Catalog and icons: mostly done

- Done 2026-11-12 18:49: seed of 13 sections and 358 items with icon and emoji and a starting list; icon rendering with fallback to emoji and letter tile; icon picker; section guess for new products from keywords in the connector suggestions and the name.
- Done 2026-11-15 14:35 (milestone 12, step 1): the 8 items without an emoji got the approved ones, and the shop's category picks the section of a new product before the keyword list does.

Done when: naming a typical new barcode takes one or two taps.

### 6. Daily-use hardening: started

- Done 2026-11-12 19:09: log file that survives restarts, hourly database backup, reconnecting pages.
- Open: use it for two weeks and fix what annoys. Since 2026-11-15 most of this arrives through the feedback button (milestone 11).
- Done 2026-11-13 01:52, released in 1.1.11: the naming prompt shows which lookup source gave no answer and can ask again. Marking such scans on the history page followed in milestone 12, step 1.
- Open: a test run of the restore procedure on another machine. A run of `install.sh` on a fresh Pi is not planned: there is no spare Pi.

- Done 2026-11-13 00:32: login with Google for the accounts on an allowlist, a secret for the hardware agent, a login page (UC-17). Live on the Pi; the owner logged in, and every data route was probed through the proxy without login and answered 401. The owner confirmed on 2026-11-13 the login inside the installed iPhone app and a handheld scan with login on, and removed the proxy's access list.

- Done 2026-11-13 01:27, released as version 1.1: the API restructured into layers and hardened, see [api-restructure-plan.md](api-restructure-plan.md).
- Done 2026-11-13 19:03, released in 1.1.11: the hardware agent holds scans while the app is unreachable and delivers them later, with a sound of their own.
- Done 2026-11-13 19:35: weekly Dependabot updates, a reviewer that judges each of them for its effect on the product, and a GitHub release per version.
- Done 2026-11-13 21:40, released in 1.1.29: an open app reloads itself when a newer web app is published (UC-10). Confirmed by the owner on the iPhone with the release of 1.1.30.
- Done 2026-11-13 22:28, released in 1.1.32: a content security policy in report-only mode, with reports in the system log, and FormatJS as message formatter because the former one needs `eval`. Open: read the log after a week and set `CSP_MODE=enforce`.
- Done 2026-11-13: a ruleset on `master` that forbids deleting it and force-pushing to it. Two-factor login on the GitHub account is on, confirmed by the owner on 2026-11-14.
- Done 2026-11-15 02:28, released in 1.1.57: the card scanner now runs on the same Pi, and its updater's image prune broke this updater's pull ("lease does not exist"), which kept the Pi on 1.1.50 for an hour. Both updaters take a shared lock around pull, restart and prune; seen working both ways the same night.

### 7. Feedback at the scanner: mostly done

- Done 2026-11-12 20:05: push notification on the phone for an unknown handheld scan (UC-12). Confirmed on the iPhone: the notification arrives, the app icon shows the inbox count, and a tap opens the inbox without reloading the app. It arrives seconds after the scan, so it does not replace a beep.
- Preferred for sound: the scanner's own beeper, triggered by the hardware agent through the dongle. The dongle has a second HID interface that accepts data from the host (report `0xBA`, 7 bytes), but its commands are undocumented; see [scanner-usb-capture.txt](scanner-usb-capture.txt). Tera support was asked for the command set on 2026-11-12; no answer yet.
- Done 2026-11-12 23:40: a buzzer on a GPIO pin (GPIO 18, an active type), driven by the hardware agent from the scan result. The sound per event is chosen on the System page from a library of sounds, with a button to hear each one (UC-16). Open: confirm the whole chain from button to buzzer after the first deploy.
- Considered: a USB speaker of about 12 euro, or any powered speaker on the Pi's headphone jack.

- Done 2026-11-13 01:59, released in 1.1.11: the System page shows whether the scanner service runs and sees the scanner, and the time of the last handheld scan.

### 8. Offline shopping: done 2026-11-13 20:10

- Done 2026-11-13 02:08, released in 1.1.17: the app starts without a connection and shows the list as last loaded.
- Done 2026-11-13 20:10: changes to the list without a connection, queued and sent on reconnect; see [offline-plan.md](offline-plan.md). Released in 1.1.17 and confirmed by the owner on the iPhone.

### Package upgrades: started

- Done 2026-11-13 20:04, released in 1.1.26: forty unused packages removed, everything updated within its major version, Yarn 4.18, Node 25 in the images and the build. The arm64 image was built and started under emulation before the release.
- Done 2026-11-13 20:22, released in 1.1.26: Nx 21 to 24, Angular 20 to 22, TypeScript 5.9 to 6.0, typescript-eslint 6 to 8 and angular-eslint 22. The lint rules moved to `eslint.config.mjs` files, the API build to the Nx webpack plugin, and the web app runs without zone.js.
- Done 2026-11-13 22:28, released in 1.1.32: `@messageformat/core` and its ngx-translate wrapper replaced by `intl-messageformat`.
- Open, one family at a time: TypeScript 7 (needs the old module resolution and `ignoreDeprecations` out of the tsconfig files first), ESLint 10, NestJS 12, TypeORM 1, Tailwind 4, ngx-translate 18, better-sqlite3 13, web-push 4.

### 9. Tests for the web app: done 2026-11-14 00:26

Released in 1.1.40 on 2026-11-14 10:42, after the owner approved the coverage. The first release run failed in the end-to-end step and deployed nothing: the build runner is fast enough to scan the same code twice within the server's one-second repeat rule. The test now waits that second out.

- Done 2026-11-13 23:10: a test runner for the web app, Vitest through Angular's own `unit-test` builder with happy-dom, so no browser is needed. `yarn product-front:test`, part of the `checks` job. The web app's build and serve targets use the `@angular/build` builders by name, which the test builder asks for.
- Done 2026-11-14 00:26: 195 tests in 22 files, reaching 95% of the statements and 96% of the lines of the web app (`yarn product-front:test:coverage`). Services: the shopping store, the event stream, the update check, login guards and logout, push, every API call with its route and body, settings, saved data, appearance, the message adapter, the failed-change interceptor. The service worker, in a stand-in worker scope. Every page and component: list with its sheets, scan with a stand-in barcode reader, inbox, products, product page, history, log, login, sounds, System page for the owner, another account and login off, the shell with its banner and messages, naming prompt, new-product form, icon picker, autocomplete, tile and icon, the drawn barcodes, the app's start and its routes.
- Done 2026-11-14 00:05: an end-to-end run, `yarn e2e`, part of the `checks` job. Playwright drives the installed Chrome, headless, against the built API and web app on an empty database with login off: type a code, name it, check it off, undo; scan it again for one more; check off without a connection and see it sent later, which needs the real service worker; read a barcode with the camera, from a picture the test draws itself and feeds to Chrome as camera; open every page and require that the browser reported nothing the content security policy would block.
- Differs from production: the end-to-end run starts the built bundles with Node, not the Docker image, and runs Chrome, not Safari. Real push delivery, the iPhone's camera and what iOS does with an installed app stay checks by hand. The tests do not look at how a page is drawn: colours, spacing and wrapping are still judged by eye.

Requested by the owner on 2026-11-13.

### 10. Owner and other accounts: first part done

- Done 2026-11-13 20:12, released in 1.1.26: one owner account; the system parts (history, log, scanner status, version, sounds, test notification) are shown to the owner only and refused by the API to other accounts. Everyone keeps language, appearance, notifications for the own device and the account with logout.
- Done 2026-11-13 21:19, released in 1.1.28: the System page in three groups (this device, account, management) and the sounds on a page of their own; 1.1.30 stacks the language and appearance rows on a phone.
- Not decided, on purpose: whether other accounts get their own list, and what they may do with products and the inbox. For now those stay shared.
- Later, said by the owner on 2026-11-13: the `ALLOWED_EMAILS` setting is to become an invite system. Not planned in detail yet.

### 11. Remarks from inside the app: done 2026-11-15 01:09

Plan and decisions in [remarks-plan.md](remarks-plan.md). Released in 1.1.48.

- Done 2026-11-15 00:44: remarks on the server: the table, the rules, routes for every account and for the owner, the limit per hour, a notification to the owner only, sending to GitHub tested against a stand-in server.
- Done 2026-11-15 00:59: the web app: the remark sheet, the row on the System page, pointing mode, right click, the queue for remarks without a connection, the Feedback page with "send to GitHub" and its preview, the message to the owner.
- Done 2026-11-15 01:03: issue forms on GitHub, the settings, the agent's workflow and instructions, the label `investigate`.
- Tried by the owner the same night: pointing mode on the iPhone, sending to GitHub, and the agent on a dozen issues.
- Not built: a way for the writer to see an answer. Decided against.

The agent, tuned after its first runs:

- Done 2026-11-15 01:40, released in 1.1.49: the first four issues all ended in questions. An issue from the owner now carries his authority: the agent implements it unless a real question is open, and labels its verdict.
- Done 2026-11-15 01:52, released in 1.1.50: pull requests open ready for review, the workflow starts their checks, and the owner is code owner of the whole repository.
- Done 2026-11-15 02:02: the issue or pull request that waits for the owner is assigned to him, also when a run fails.
- Done 2026-11-15 12:04: the agent may not reformat code it does not change; it had rewritten whole files twice.

What the agent built from the owner's feedback, each reviewed, finished and landed locally:

| Version | Issues | What changed for the user | Changed in review |
|---|---|---|---|
| 1.1.56 | #9, #10, #11, #12 | two-finger tap removed; remarks about the bottom menu; a number for open feedback; rejecting a remark | number for the owner only; formatter noise removed |
| 1.1.60 | #17, #18 | a hint that fits the device; the row highlight stays inside the card | wording on a computer, a test clean-up |
| 1.1.63 | #21, #23 | handled remarks fold away; a "What's new" page | the changelog is written by the build, so a release lists itself |
| 1.1.65 | #26 | "Let the agent look at it" first and ticked | Nx cache bug of the changelog fixed |
| 1.1.67 | #25 | actions under a menu, Ctrl+Enter sends, a question when closing with text | one action shows as a button; Handle in the menu; plainer close question |

### 12. Names, sections and variants: started

Plan in [naming-plan.md](naming-plan.md), agreed with the owner on 2026-11-15. Four steps: small leftovers and the section from the shop's category; variants on the list; naming rules; an AI suggestion behind the rules. The AI step is deferred (owner, 2026-11-15): no paid API, and the free options are listed in naming-plan.md.

- Done 2026-11-15 14:35, released in 1.1.70: step 1. The server maps the shop's category to a section (`core/rules/shop-sections.ts`) and adds it to each suggestion as `sectionId`; the new-product form takes it before the keyword guess. The history page marks scans of unnamed barcodes whose lookup failed and opens the naming prompt for them. The eight products without an emoji get the approved ones (migration, only where none was chosen, and the seed file). The hardware agent no longer sends `source`. Suggestions stored before this keep using the keyword guess.
- Done 2026-11-15 15:12, released in 1.1.76: step 2. List entries have their own id; a product can be on the list once per note, and a note that another line of the product has merges them. The search shows each line of a product with "+1" and a plain tile for a new line. A barcode can carry a variant, set in the naming prompt and shown on the product page; its scans and their undo go to that line. Offline adds and changes queue by entry id. Migration keeps every entry and trims its note.
- Done 2026-11-15 15:45, on branch `feature/naming-step-3`, not released: step 3. The naming prompt shows a proposal from the shop titles (`core/rules/naming.ts`): the existing product whose whole words the title names, most specific first, with the rest of the title as variant, or a new name without brand, shop name and amount. One tap links it or opens the new product form. Matching compound words ("Hazelnootpasta" as "Pasta") was tried on the real barcodes and dropped. Step 4, the AI suggestion, is deferred.

### Smaller changes outside the milestones

- Done 2026-11-15 12:04, released in 1.1.63: a "What's new" page for every account, backfilled from the git tags (issue #23). The build writes the changelog, so each release lists itself.
- Done 2026-11-13 21:02, released in 1.1.27: searching on the list page also shows products that are already on the list, as "+1".

## Open points

| Point | Needed by |
|---|---|
| Content security policy: read the system log for "content policy" lines after a week of use (from 2026-11-20), fix what shows, then set `CSP_MODE=enforce` on the Pi | Milestone 6 |
| Tera's answer on the beeper commands | Milestone 7 |

## Never tested

- The restore procedure on a second machine. A dump was loaded into a scratch database on the Pi and matched the live row counts.
- Rollback with `IMAGE_TAG`.
- A reboot with the firewall service since it was added.
- Push notifications in a desktop browser, which takes the service worker path.
- The view of an account that is not the owner, on the live site: tried only in a local container with a test session.
- The content security policy in enforcing mode.

Not planned, no hardware for it (owner, 2026-11-15): `install.sh` on a fresh Pi, and push notifications on Android.
