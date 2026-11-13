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
- Login with Google for an allowlist of accounts: one global guard, signed session cookie, a token for the hardware agent. New routes are for logged-in users by default; mark one `@Public()` only when it must work without login, `@Agent()` only when the hardware agent needs it, and `@OwnerOnly()` when it belongs to the system parts that only the owner account gets.
- No Bring, no PostgreSQL, no CQRS, no user table.
- Deployment: GitHub Actions builds images to `ghcr.io`; systemd timers on the Pi pull them and push an hourly database backup to a private repository.

## Layout

| Part | Directory | Notes |
|---|---|---|
| API | `apps/product-api/` | NestJS, TypeORM, SQLite. Layers under `src/`: `api` (controllers, dto, guards), `core` (services, rules, connectors), `data` (entities, migrations), `config`. Integration tests in `src/test/` |
| Web app | `apps/product-front/` | Angular 22, TailwindCSS. Pages in `src/app/pages/`, shared pieces in `components/`, state in `services/shopping.store.ts`, texts in `src/assets/i18n/` |
| Hardware agent | `apps/hardware-agent/` | Python, evdev |
| Deployment | `deployment/` | Compose file and the scripts the Pi fetches from `master`: `install.sh`, `update.sh`, `firewall.sh`, `backup.sh` |
| End-to-end tests | `e2e/` | Playwright with the installed Chrome; starts the built app itself (`start-app.mjs`) and makes its own camera picture (`barcode-video.mjs`) |
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
yarn product-api:test                 # scan rules, session signing
yarn product-api:test:integration     # services on a temporary SQLite file; login guard, data routes and the whole app over HTTP
yarn product-front:test               # the web app's logic and components, in Vitest without a browser
yarn product-front:test:coverage      # the same, with a table of what the tests reach per file
yarn e2e                              # builds both apps, starts them on port 3931 with an empty database and drives them in headless Chrome
yarn hardware-agent:test              # the agent with a fake scanner, buzzer and API; needs Python 3 only
```

Don't start the serve commands from a session; ask the user to run them. The build runs lint, all four test commands and `yarn e2e` first, so keep them green. Web app tests sit next to the file they test as `*.spec.ts`; shared stand-ins for the store and the event stream are in `src/testing/fakes.ts`. A change to the web app comes with its test.

## Code style

- Prettier: single quotes, 120 characters, 4-space indent, LF.
- ESLint: strict TypeScript (`no-any`, `explicit-member-accessibility`), ordered imports, blank lines between multi-line class members, max 75 lines per function.
- Angular: prefix `app`, standalone components, signals over observables in components, `@ngx-translate` with EN and NL. Every visible text goes in both language files.
- Styling: colours come from the CSS variables in `styles.scss`, which carry the light and dark theme. No hard-coded colours in components.
- NestJS: controller calls service, service uses TypeORM directly. No use-case classes, mappers or repository interfaces. Schema changes need a new migration; `synchronize` is off.
- API layers: one controller, request type, entity or service per file. Imports point inward only (`api` to `core` to `data`); lint enforces it. Module files only wire things together.
- Settings: read them through `AppConfig`; `process.env` is forbidden elsewhere.
- A table has one owning service; other services ask it. Work that writes several tables runs through `TransactionRunner`, and events go out after it.
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
