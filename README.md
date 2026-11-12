# Barcode Scanner

Scan the barcode of an empty package before tossing it, and the product lands on the household shopping list. A handheld scanner is connected to a Raspberry Pi; a phone can scan with its camera through the web page.

The repository holds a prototype that is being rebuilt. Start with the documentation:

| Document | Content |
|---|---|
| [docs/plan.md](docs/plan.md) | Current state and milestones |
| [docs/use-cases.md](docs/use-cases.md) | What the product does |
| [docs/decisions.md](docs/decisions.md) | Feature and technology choices |
| [docs/architecture.md](docs/architecture.md) | Target architecture, data model, API |
| [docs/deployment.md](docs/deployment.md) | Raspberry Pi setup and automatic updates |

## Apps

| App | Directory | Stack |
|---|---|---|
| Product API | `apps/product-api/` | NestJS, TypeORM |
| Product Frontend | `apps/product-front/` | Angular 20, TailwindCSS |
| Hardware Agent | `apps/hardware-agent/` | Python, evdev, Docker |

## Development

Needs Node.js LTS and Yarn 4.

```bash
yarn install
yarn product-api:serve      # port 3020
yarn product-front:serve    # port 4200
yarn lint:all
```

The API reads its database settings from `apps/product-api/.env` (`DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, `DATABASE_NAME`). That file is not committed.

## Data

`data/seed-items.json` holds the sections, items and current list used to seed the catalog. `data/icons/` holds one icon per item, named after the item's `icon` value.
