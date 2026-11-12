# Barcode Scanner

Scan an empty package's barcode (handheld scanner on a Raspberry Pi, or phone camera) and the product lands on the app's own shopping list. Single user, home use.

## Read first

Before changing code, read:

- `docs/plan.md` — what is done, what is open, what was never tested
- `docs/decisions.md` — settled choices; don't reopen them without the user
- `docs/architecture.md` — modules, data model, scan rules, API, web app
- `docs/deployment.md` — pull-based Docker deployment on the Pi, backup, notifications
- `docs/use-cases.md` — expected behaviour

When a decision changes, update `docs/decisions.md` first, then the affected docs. When marking something done in `docs/plan.md`, add the date and time (`done 2026-11-12 19:09`). When behaviour changes, update the use case and `README.md` with it.

## In short

- One `app` container: NestJS serves `/api/v1/...` and the built Angular app. SQLite at `/data/app.db`.
- One `hardware-agent` container: Python `evdev`, reads the scanner, posts scans and its log lines to the API.
- Product lookup through `ProductConnector` classes, all queried in parallel; results are suggestions, the user names each barcode once.
- Web push for unknown handheld scans; the service worker (`src/sw.js`) caches nothing.
- No Bring, no PostgreSQL, no CQRS, no auth code (the reverse proxy does login).
- Deployment: GitHub Actions builds images to `ghcr.io`; systemd timers on the Pi pull them and push an hourly database backup to a private repository.

## Layout

| Part | Directory | Notes |
|---|---|---|
| API | `apps/product-api/` | NestJS, TypeORM, SQLite. Modules: `scan`, `catalog`, `list`, `connectors`, `events`, `log`, `push`. Hand-written migrations in `src/data/migrations/` |
| Web app | `apps/product-front/` | Angular 20, TailwindCSS. Pages in `src/app/pages/`, shared pieces in `components/`, state in `services/shopping.store.ts`, texts in `src/assets/i18n/` |
| Hardware agent | `apps/hardware-agent/` | Python, evdev |
| Deployment | `deployment/` | Compose file and the scripts the Pi fetches from `master`: `install.sh`, `update.sh`, `firewall.sh`, `backup.sh` |
| Data | `data/` | `seed-items.json` and `icons/` are committed; everything else is ignored |

Nx project names: `product-api`, `product-front`.

## Commands

```bash
yarn install
yarn product-api:serve      # port 3020
yarn product-api:build
yarn product-front:serve    # port 4200
yarn product-front:build
yarn lint:all
yarn product-api:test                 # scan rules
yarn product-api:test:integration     # real modules, temporary SQLite file
```

Don't start the serve commands from a session; ask the user to run them. The image build runs lint and both test commands first, so keep them green.

## Code style

- Prettier: single quotes, 120 characters, 4-space indent, LF.
- ESLint: strict TypeScript (`no-any`, `explicit-member-accessibility`), ordered imports, blank lines between multi-line class members, max 75 lines per function.
- Angular: prefix `app`, standalone components, signals over observables in components, `@ngx-translate` with EN and NL. Every visible text goes in both language files.
- Styling: colours come from the CSS variables in `styles.scss`, which carry the light and dark theme. No hard-coded colours in components.
- NestJS: controller calls service, service uses TypeORM directly. No extra layers. Schema changes need a new migration; `synchronize` is off.
- No explanatory comments.

## Hard rules

- No secrets in the repo. `.env` files and everything in `data/` except the seed file and icons are git-ignored.
- `data/icons/` holds the user's own icon set and `data/seed-items.json` the seed data. Both are committed and ship in the image.
- The repo and images are public. Runtime settings go in the `.env` file on the Pi, keys in its `data/` folder, never in code, docs or an image. No LAN addresses or personal addresses in the docs.
- The database backup repository is private and separate; nothing from it belongs here.
- Bring's web app is a functional reference for the list page, nothing more.
- The app must work without the icon folder.
- Supermarket APIs are unofficial: a connector failure must never fail a scan. The same goes for a failed push notification.
- Docs live in `docs/`.
