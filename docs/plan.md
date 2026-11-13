# Plan

How the prototype became the product, and what is left. Decisions behind this plan are in [decisions.md](decisions.md); how it works is in [architecture.md](architecture.md) and [deployment.md](deployment.md).

## Where it stands (2026-11-12)

In daily-use shape and running on the Pi:

- Handheld and camera scanning, the scan rules, inbox and naming, the list, product management, history with undo, the system log.
- Automatic updates from `master`, the firewall limit to the reverse proxy, an hourly database backup to a private repository.
- Installable on the phone, Dutch and English, light and dark, push notifications for unknown handheld scans.

Open: sound at the scanner (milestone 7), offline shopping (milestone 8), and the hardening that only daily use brings (milestone 6). The list of things never tested is at the end.

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
- Done 2026-11-13 02:05, on branch `feature/connector-failures`, not released: the naming prompt shows which lookup source gave no answer and can ask again. Not done: marking such scans on the history page.
- Open: a test run of `install.sh` and of the restore procedure on a fresh Pi.

- Done 2026-11-13 00:32: login with Google for the accounts on an allowlist, a secret for the hardware agent, a login page (UC-17). Live on the Pi; the owner logged in, and every data route was probed through the proxy without login and answered 401. Open: log in inside the installed iPhone app, one handheld scan with login on, remove the proxy's access list.

- Done 2026-11-13 01:27, on branch `feature/api-restructure`, not yet released: the API restructured into layers and hardened, see [api-restructure-plan.md](api-restructure-plan.md). Releases as version 1.1.0.

### 7. Feedback at the scanner: mostly done

- Done 2026-11-12 20:05: push notification on the phone for an unknown handheld scan (UC-12). Confirmed on the iPhone: the notification arrives, the app icon shows the inbox count, and a tap opens the inbox without reloading the app. It arrives seconds after the scan, so it does not replace a beep.
- Preferred for sound: the scanner's own beeper, triggered by the hardware agent through the dongle. The dongle has a second HID interface that accepts data from the host (report `0xBA`, 7 bytes), but its commands are undocumented; see [scanner-usb-capture.txt](scanner-usb-capture.txt). Tera support was asked for the command set on 2026-11-12; no answer yet.
- Done 2026-11-12 23:40: a buzzer on a GPIO pin (GPIO 18, an active type), driven by the hardware agent from the scan result. The sound per event is chosen on the System page from a library of sounds, with a button to hear each one (UC-16). Open: confirm the whole chain from button to buzzer after the first deploy.
- Considered: a USB speaker of about 12 euro, or any powered speaker on the Pi's headphone jack.

- Done 2026-11-13 02:20, on branch `feature/scanner-status`, not released: the System page shows whether the scanner service runs and sees the scanner, and the time of the last handheld scan. Untested with the real agent and scanner.

### 8. Offline shopping: open

- Cached list, queued check-offs and adds, sync on reconnect. The service worker that exists today only handles notifications and caches nothing.

## Open points

| Point | Needed by |
|---|---|
| Tera's answer on the beeper commands | Milestone 7 |

## Never tested

- `install.sh` on a fresh Pi since the firewall, backup, notification, buzzer and login additions (agent token, GPIO device). The same steps were done by hand on the running Pi.
- The restore procedure on a second machine. A dump was loaded into a scratch database on the Pi and matched the live row counts.
- Rollback with `IMAGE_TAG`.
- A reboot with the firewall service since it was added.
- Push notifications on anything but the iPhone (Android, desktop browsers), which take the service worker path.
- After the API restructure is released: the image build, the server start with the real log file, and the hardware agent against the narrowed token.
- The version in the workflow's job names and run summary, until the first run after 2026-11-13.
