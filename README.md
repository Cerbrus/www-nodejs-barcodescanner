# Barcode Scanner

Scan the barcode of an empty package before tossing it, and the product lands on the household shopping list. A handheld scanner is connected to a Raspberry Pi; a phone can scan with its camera through the web page. One user, one list, home use.

## What it does

- **Scan to list**: a known barcode puts its product on the list, or counts the quantity up. A second read within 1 second is ignored.
- **Name once**: an unknown barcode waits in an inbox. Albert Heijn and Open Food Facts are asked what it is, the user picks or creates the product once, and every later scan is automatic.
- **Shopping list**: tiles grouped by shop section, with icon, quantity and note. Tap to check off, tap a recent item to put it back, search to add by hand, remove what should not come back.
- **Phone**: camera scanning, installable on the home screen, light and dark theme, Dutch and English, push notification when the handheld scanner reads something unknown.
- **Sound**: a buzzer at the scanner beeps the result of each scan; which sound for which result is chosen in the app.
- **Oversight**: scan history with undo, a live system log, and a page per product with its barcodes.
- **Runs itself**: the Pi pulls new versions by itself and pushes an hourly database backup to a private repository.

## How it is built

| Part | Directory | Stack |
|---|---|---|
| API | `apps/product-api/` | NestJS, TypeORM, SQLite; layered into `api`, `core`, `data`, `config` |
| Web app | `apps/product-front/` | Angular 20, TailwindCSS |
| Hardware agent | `apps/hardware-agent/` | Python, evdev, libgpiod |
| Deployment | `deployment/` | Docker Compose, systemd timers, shell scripts |
| Seed data and icons | `data/` | `seed-items.json`, `icons/*.png` |

On the Pi two containers run: `app` (API plus the built web app, SQLite file on a volume) and `hardware-agent` (reads the scanner, posts scans to the API). A reverse proxy in front provides HTTPS. Login is with Google, for the accounts on an allowlist.

## Documentation

| Document | Content |
|---|---|
| [docs/use-cases.md](docs/use-cases.md) | What the product does, from the user's point of view |
| [docs/architecture.md](docs/architecture.md) | Modules, data model, scan rules, API, web app |
| [docs/deployment.md](docs/deployment.md) | Raspberry Pi setup, automatic updates, reverse proxy, backup and restore, notifications |
| [docs/decisions.md](docs/decisions.md) | Feature and technology choices, with the reasoning |
| [docs/plan.md](docs/plan.md) | Milestones, what is done and what is open |

## Development

Needs Node.js 24 and Yarn 4.

```bash
yarn install
yarn product-api:serve                # API on port 3020
yarn product-front:serve              # web app on port 4200, talks to the API on 3020
yarn lint:all
yarn product-api:test                 # scan rules and session signing
yarn product-api:test:integration     # services against a temporary SQLite file; login guard, data routes and the whole app over HTTP
```

The API keeps its data in a SQLite file, `data/app.db` by default (`DATABASE_PATH` overrides it). It is created and seeded from `data/seed-items.json` on first start and is not committed. `GET /api/v1/health` reports the status and the running version (`dev` locally; builds of `master` get a version such as `1.0.20`, see docs/deployment.md).

The camera and notifications need HTTPS, so they work through the reverse proxy and on `localhost`, not on a plain LAN address.

## Deployment in short

A push to `master` builds two `linux/arm64` images on GitHub Actions and publishes them to `ghcr.io`. A timer on the Pi pulls them every 5 minutes. First install on a Pi:

```bash
curl -fsSLO https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment/install.sh
sudo bash install.sh
```

Details, settings and the restore procedure are in [docs/deployment.md](docs/deployment.md).

## Data

`data/seed-items.json` holds the shop sections, the products with icon and emoji, and a starting list. `data/icons/` holds one icon per product, named after the product's `icon` value. Both ship inside the image. Nothing secret is in this repository or in the images: settings live in `.env` on the Pi, the database and keys in its `data/` folder.
