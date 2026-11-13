# Plan

How the prototype became the product, and what is left. Decisions behind this plan are in [decisions.md](decisions.md); how it works is in [architecture.md](architecture.md) and [deployment.md](deployment.md).

## Where it stands (2026-11-13, version 1.1.32)

In daily-use shape and running on the Pi:

- Handheld and camera scanning, the scan rules, inbox and naming, the list, product management, history with undo, the system log.
- Automatic updates from `master`, the firewall limit to the reverse proxy, an hourly database backup to a private repository. An open app reloads itself after an update.
- Installable on the phone, Dutch and English, light and dark, push notifications for unknown handheld scans, shopping without a connection.
- Login with Google for an allowlist, with one owner account for the system parts. A buzzer at the scanner.
- Current packages: Node 25, Nx 24, Angular 22, TypeScript 6. A content security policy in report-only mode.

## What comes next

In this order, agreed with the owner on 2026-11-13:

1. **Tests for the web app** (milestone 9): built, 195 tests and an end-to-end run; waits for the owner's release.
2. **The remaining package families** (see "Package upgrades"), one at a time, after the web app has tests to catch what breaks. Dependabot proposes the small ones weekly and its reviewer comments on them.
3. **Waiting on time or on the owner**: switch the content security policy to enforcing after a week of clean logs (from 2026-11-20); two weeks of daily use (milestone 6); the choices for other accounts and the invite system (milestone 10); Tera's answer on the beeper.
4. **Operations never tested** (list at the end). The rollback with `IMAGE_TAG` is the cheap one: two minutes on the Pi, and it proves the way back.
5. **Small leftovers**: mark scans whose lookup failed on the history page; guess the section from the connector's categories; the eight products without an emoji; remove the unused `source` field from the hardware agent, due since version 1.1.0.

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
- Open: 8 items have no fitting emoji (Vijgen, Kaneel, Tofu, Aluminium Folie, Vershoudfolie, Condooms, Wattenschijfjes, Wattenstaafjes) and rely on their icon file.
- Open: the section guess is a short keyword list in the web app. A proper mapping from connector categories to sections would guess better.

Done when: naming a typical new barcode takes one or two taps.

### 6. Daily-use hardening: started

- Done 2026-11-12 19:09: log file that survives restarts, hourly database backup, reconnecting pages.
- Open: use it for two weeks and fix what annoys.
- Done 2026-11-13 01:52, released in 1.1.11: the naming prompt shows which lookup source gave no answer and can ask again. Not done: marking such scans on the history page.
- Open: a test run of `install.sh` and of the restore procedure on a fresh Pi.

- Done 2026-11-13 00:32: login with Google for the accounts on an allowlist, a secret for the hardware agent, a login page (UC-17). Live on the Pi; the owner logged in, and every data route was probed through the proxy without login and answered 401. The owner confirmed on 2026-11-13 the login inside the installed iPhone app and a handheld scan with login on, and removed the proxy's access list.

- Done 2026-11-13 01:27, released as version 1.1: the API restructured into layers and hardened, see [api-restructure-plan.md](api-restructure-plan.md).
- Done 2026-11-13 19:03, released in 1.1.11: the hardware agent holds scans while the app is unreachable and delivers them later, with a sound of their own.
- Done 2026-11-13 19:35: weekly Dependabot updates, a reviewer that judges each of them for its effect on the product, and a GitHub release per version.
- Done 2026-11-13 21:40, released in 1.1.29: an open app reloads itself when a newer web app is published (UC-10). Confirmed by the owner on the iPhone with the release of 1.1.30.
- Done 2026-11-13 22:28, released in 1.1.32: a content security policy in report-only mode, with reports in the system log, and FormatJS as message formatter because the former one needs `eval`. Open: read the log after a week and set `CSP_MODE=enforce`.
- Done 2026-11-13: a ruleset on `master` that forbids deleting it and force-pushing to it. Two-factor login on the GitHub account is on, confirmed by the owner on 2026-11-14.

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

On branch `feature/web-app-tests`, not released yet: the owner releases it when satisfied with the coverage.

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

### Smaller changes outside the milestones

- Done 2026-11-13 21:02, released in 1.1.27: searching on the list page also shows products that are already on the list, as "+1".

## Open points

| Point | Needed by |
|---|---|
| Content security policy: read the system log for "content policy" lines after a week of use (from 2026-11-20), fix what shows, then set `CSP_MODE=enforce` on the Pi | Milestone 6 |
| Tera's answer on the beeper commands | Milestone 7 |

## Never tested

- `install.sh` on a fresh Pi since the firewall, backup, notification, buzzer and login additions (agent token, GPIO device). The same steps were done by hand on the running Pi.
- The restore procedure on a second machine. A dump was loaded into a scratch database on the Pi and matched the live row counts.
- Rollback with `IMAGE_TAG`.
- A reboot with the firewall service since it was added.
- Push notifications on anything but the iPhone (Android, desktop browsers), which take the service worker path.
- The view of an account that is not the owner, on the live site: tried only in a local container with a test session.
- The content security policy in enforcing mode.
