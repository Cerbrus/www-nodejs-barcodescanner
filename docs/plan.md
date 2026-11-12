# Plan: prototype to usable product

Decisions behind this plan are in [decisions.md](decisions.md); the target is in [architecture.md](architecture.md) and [deployment.md](deployment.md).

## Where the prototype stands (2026-11-12)

- The repository has no commits yet.
- The API is a skeleton since milestone 2: SQLite connection, health endpoint, static serving of the frontend, and the Albert Heijn connector in TypeScript, not yet wired in. No endpoint writes a scan.
- The frontend is a leftover Slack-poll app whose only page renders a barcode image.
- Both Python `requirements.txt` files are UTF-16 and list unrelated heavy packages.

## Milestones

Each milestone ends in something that runs. Milestones 1 and 2 remove the two biggest risks before any feature work.

### 0. Clean start

- Delete what the target does not need: `apps/supermarkt-connector/`, `run.sh`, the root `docker-compose.yml`, `barcodes.txt`, `.run/` entries for removed apps, the `aldi-wrapper`, `jumbo-wrapper` and `albert-heijn-wrapper` packages.
- First commit and push.
- Check the Pi's architecture and Docker version ([deployment.md](deployment.md)).

Status 2026-11-12: done. Files and packages deleted, Pi checked, first commit pushed. The old push-based workflow in `.github/workflows/` is already removed; milestone 2 adds the new one.

Done when: the repo is on GitHub with no secrets in it, and the image platform is known.

### 1. Scanner spike on the Pi

- Write the hardware agent: `evdev`, device path from `SCANNER_DEVICE`, exclusive grab, reopen loop, digits plus Enter become one scan, log it.
- Run it on the Pi in a container with the `/dev/input` mount and the cgroup rule.

Done when: scans are logged from inside the container, nothing is typed into the Pi's console, and scanning still works after unplugging and replugging the dongle and after a reboot. If not, switch to the host systemd fallback and note it in `decisions.md`.

Status 2026-11-12: passed. `apps/hardware-agent/` runs on the Pi in an unprivileged container (image built on the Pi for the spike only). Scans are logged, nothing reaches the Pi's console, the agent reconnects by itself after a replug, and after a reboot the container starts and reconnects without help. The Docker approach stays; no host-service fallback needed. The scanner sometimes reads one code twice within two seconds, which the debounce in milestone 3 covers.

### 2. Pull-based deployment

- Dockerfiles for `app` (multi-stage, Node slim) and `hardware-agent`.
- GitHub workflow: build both images for the Pi's platform, push to `ghcr.io` with `latest` and commit-hash tags. Lint on pull requests.
- `deployment/docker-compose.yml`, `deployment/install.sh`, the updater service and timer.
- Remove `deployment/setup-pi.sh`, `add-site.sh`, `add-python-site.sh` and the old workflow. Keep the fan control script only if it is not already installed on the Pi.
- Nginx Proxy Manager host with certificate and access list.
- Add `GET /api/v1/health`.

Done when: a trivial change pushed to `master` is live on the Pi within minutes without touching the Pi, and the site opens over HTTPS behind the login.

### 3. Backend core

- Done in milestone 2: TypeORM on SQLite at `/data/app.db`; CQRS, mappers, repositories, the exception-filter stack and the PostgreSQL entities and migration removed.
- Add plain modules: `scan`, `catalog`, `list`, `connectors`, `events`, with entities and a first migration.
- Data model and scan rules from `architecture.md`, including debounce, count up, inbox and undo.
- Connector interface; port the Albert Heijn connector to it; add Open Food Facts.
- Server-sent events.
- Unit tests for the scan rules; they are the heart of the product.
- Hardware agent posts scans to the API.

Done when: a handheld scan of a mapped barcode changes the list in the database, an unmapped one lands in the inbox with suggestions, and undo reverses the last scan. Checked with `curl` and the tests.

### 4. Frontend

- Remove the poll leftovers and unused components.
- List page: tiles by section, quantity, note, check-off, recent, manual add, offline banner.
- Naming prompt and inbox, fed by events.
- Scan page with the phone camera, continuous mode, undo toast. Test the decoder on the real phone first.
- Catalog and mappings page; history page.
- Signals and `@for`/`@empty` as in the code style; Dutch and English texts.

Done when: every use case in [use-cases.md](use-cases.md) except offline use and sound works on the phone through the proxy.

### 5. Catalog and icons

- Seed the catalog from [data/seed-items.json](../data/seed-items.json): 13 sections and 358 items with icon and emoji, and the 16 list entries with state and note.
- 8 items have no fitting emoji (Vijgen, Kaneel, Tofu, Aluminium Folie, Vershoudfolie, Condooms, Wattenschijfjes, Wattenstaafjes); they rely on their icon file.
- Icon rendering: icon file, then emoji, then letter tile.
- Icon picker in the catalog editor.
- Map connector categories to sections.

Done when: naming a typical new barcode takes one or two taps.

### 6. Daily-use hardening

- Use it for two weeks and fix what annoys.
- Logging that makes sense in `docker compose logs`; database backup before migrations.
- Connector failures visible on the history page.

### 7. Sound feedback

- Preferred, if possible: the scanner's own beeper, triggered by the hardware agent through the dongle. The dongle has a second HID interface that accepts data from the host (report `0xBA`, 7 bytes), but its commands are undocumented; see [scanner-usb-capture.txt](scanner-usb-capture.txt). Tera support was asked for the command set on 2026-11-12.
- Otherwise: choose hardware (USB speaker or GPIO buzzer on a free pin).
- Implement the chosen output in the hardware agent; give the container access to the vendor HID interface, the audio device or GPIO.

### 8. Offline shopping

- Installable web app, cached list, queued check-offs and adds, sync on reconnect.

## Open points

| Point | Needed by |
|---|---|
| Feedback output: scanner's own beeper (waiting for Tera's answer) or a speaker or buzzer on the Pi | Milestone 7 |

Answered: Nginx Proxy Manager runs on a different Pi; scanning phone is an iPhone; the server Pi is a 3 Model B+ with a 64-bit OS and no Docker yet ([deployment.md](deployment.md)).
