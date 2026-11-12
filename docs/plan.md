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

Each milestone ends in something that runs. Milestones 1 and 2 removed the two biggest risks before any feature work.

### 0. Clean start: done

- Deleted what the target does not need: the Python supermarket connector, `run.sh`, the root `docker-compose.yml`, `barcodes.txt`, run configurations of removed apps, unused supermarket packages.
- First commit and push; checked the Pi's architecture and Docker version.

### 1. Scanner spike on the Pi: done

- Hardware agent with `evdev`: device path from `SCANNER_DEVICE`, exclusive grab, reopen loop, digits plus Enter become one scan.
- Runs on the Pi in an unprivileged container with the `/dev/input` mount and the cgroup rule.

Result: scans are logged, nothing reaches the Pi's console, the agent reconnects by itself after a replug and after a reboot. No host-service fallback needed. The scanner sometimes read one code twice within two seconds. The debounce was 3 seconds then and covered that; it is 1 second now, so a double read more than a second apart counts twice and needs an undo.

### 2. Pull-based deployment: done

- Dockerfiles for `app` (multi-stage, Node slim) and `hardware-agent`.
- GitHub workflow: lint and tests, then both images for `linux/arm64`, pushed to `ghcr.io` with `latest` and commit-hash tags.
- `deployment/docker-compose.yml`, `install.sh`, `update.sh`, `firewall.sh`, the update timer and firewall service.
- Nginx Proxy Manager host with certificate and access list.

Result: a push to `master` reaches the Pi by itself, typically within ten minutes including the build. The app's port is limited to the reverse proxy's address.

### 3. Backend core: done

- TypeORM on SQLite; plain modules `scan`, `catalog`, `list`, `connectors`, `events`, `log`; migrations; seed import on an empty database.
- Scan rules with debounce, count up, inbox and undo.
- Albert Heijn and Open Food Facts connectors behind one interface.
- Server-sent events; the hardware agent posts scans and its log lines.

Tests: 9 for the scan rules (`yarn product-api:test`) and 6 that run the real modules against a temporary SQLite file (`yarn product-api:test:integration`). Not covered by tests: the connectors' calls to the outside world, the HTTP layer, push sending. Verified by hand on the Pi: handheld scans reach the inbox, both connectors return suggestions, mapping a barcode applies its waiting scans, undo takes the last one back.

### 4. Frontend: done

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

Open question: the page once froze on the iPhone after an unknown camera scan. The likely cause, the camera decoding behind the dialog, is removed; it has not happened since, but it was never reproduced either.

### 5. Catalog and icons: mostly done

- Done: seed of 13 sections and 358 items with icon and emoji and a starting list; icon rendering with fallback to emoji and letter tile; icon picker; section guess for new products from keywords in the connector suggestions and the name.
- Open: 8 items have no fitting emoji (Vijgen, Kaneel, Tofu, Aluminium Folie, Vershoudfolie, Condooms, Wattenschijfjes, Wattenstaafjes) and rely on their icon file.
- Open: the section guess is a short keyword list in the web app. A proper mapping from connector categories to sections would guess better.

Done when: naming a typical new barcode takes one or two taps.

### 6. Daily-use hardening: started

- Done: log file that survives restarts, hourly database backup, reconnecting pages.
- Open: use it for two weeks and fix what annoys.
- Open: connector failures visible on the history page; today they are only in the system log.
- Open: a test run of `install.sh` and of the restore procedure on a fresh Pi.

### 7. Feedback at the scanner: open

- Built: push notification on the phone for an unknown handheld scan (UC-12). It arrives seconds after the scan, so it does not replace a beep.
- Preferred for sound: the scanner's own beeper, triggered by the hardware agent through the dongle. The dongle has a second HID interface that accepts data from the host (report `0xBA`, 7 bytes), but its commands are undocumented; see [scanner-usb-capture.txt](scanner-usb-capture.txt). Tera support was asked for the command set on 2026-11-12; no answer yet.
- Otherwise: a USB speaker or a GPIO buzzer on a free pin, driven by the hardware agent from the scan result.

### 8. Offline shopping: open

- Cached list, queued check-offs and adds, sync on reconnect. The service worker that exists today only handles notifications and caches nothing.

## Open points

| Point | Needed by |
|---|---|
| Tera's answer on the beeper commands, or the choice of a speaker or buzzer | Milestone 7 |
| First notification on the real iPhone, and whether Apple accepts the contact address | Milestone 7 |

## Never tested

- `install.sh` on a fresh Pi since the firewall, backup and notification additions. The same steps were done by hand on the running Pi.
- The restore procedure on a second machine. A dump was loaded into a scratch database on the Pi and matched the live row counts.
- Rollback with `IMAGE_TAG`.
- A reboot with the firewall service since it was added.
- Push notifications on a real device.
