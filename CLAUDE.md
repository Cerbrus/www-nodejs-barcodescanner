# Barcode Scanner

Scan an empty package's barcode (handheld scanner on a Raspberry Pi, or phone camera) and the product lands on the app's own shopping list. Single user, home use.

## Read first

The repo is a prototype being rebuilt. Before changing code, read:

- `docs/plan.md` — current state, milestones, what is being removed
- `docs/decisions.md` — settled choices; don't reopen them without the user
- `docs/architecture.md` — target modules, data model, scan rules, API
- `docs/deployment.md` — pull-based Docker deployment on the Pi
- `docs/use-cases.md` — expected behaviour

When a decision changes, update `docs/decisions.md` first, then the affected docs.

## Target in short

- One `app` container: NestJS serves `/api/v1/...` and the built Angular app. SQLite at `/data/app.db`.
- One `hardware-agent` container: Python `evdev`, reads the scanner, posts to the API.
- Product lookup through `ProductConnector` classes, all queried in parallel; results are suggestions, the user names each barcode once.
- No Bring, no PostgreSQL, no CQRS, no auth code (the reverse proxy does login).
- Deployment: GitHub Actions builds images to `ghcr.io`; a systemd timer on the Pi pulls them.

## Current layout (prototype)

| App | Directory | Stack | Fate |
|---|---|---|---|
| Product API | `apps/product-api/` | NestJS, TypeORM, SQLite | Modules: scan, catalog, list, connectors, events, log |
| Product Frontend | `apps/product-front/` | Angular 20, TailwindCSS | Mobile-first pages under `src/app/pages/`, shared state in `services/shopping.store.ts` |
| Hardware Agent | `apps/hardware-agent/` | Python, evdev | Reads the scanner; posts scans to the API from milestone 3 |

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

Don't start the serve commands from a session; ask the user to run them.

## Code style

- Prettier: single quotes, 120 characters, 4-space indent, LF.
- ESLint: strict TypeScript (`no-any`, `explicit-member-accessibility`), ordered imports, max 75 lines per function.
- Angular: prefix `app`, standalone components, signals over observables in components, `@ngx-translate` with EN and NL.
- NestJS: controller calls service, service uses TypeORM directly. No extra layers.
- No explanatory comments.

## Hard rules

- No secrets in the repo. `.env` files and everything in `data/` except the seed file and icons are git-ignored.
- `data/icons/` holds the user's own icon set and `data/seed-items.json` the seed data. Both are committed and ship in the image.
- The repo and images are public. Runtime credentials go in the `.env` file on the Pi, never in code, docs or an image.
- Bring's web app is a functional reference for the list page, nothing more.
- The app must work without the icon folder.
- Supermarket APIs are unofficial: a connector failure must never fail a scan.
- Docs live in `docs/`.
