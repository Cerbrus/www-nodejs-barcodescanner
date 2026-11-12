# Target architecture

This is where the project is going. For the current prototype, see [plan.md](plan.md).

```
 handheld scanner          phone / browser
        │ USB dongle              │ HTTPS
        ▼                         ▼
┌────────────────┐        ┌─────────────────────┐
│ hardware-agent │        │ Nginx Proxy Manager │  login + certificate
│ Python, evdev  │        └──────────┬──────────┘
└───────┬────────┘                   │
        │ POST /api/v1/scans         ▼
        │                 ┌─────────────────────────────┐      ┌───────────────────┐
        └────────────────►│ app (one container)         │─────►│ product connectors│
                          │ NestJS: API + Angular files │      │ AH, Open Food     │
                          │ SQLite on /data             │      │ Facts, ...        │
                          └─────────────────────────────┘      └───────────────────┘
```

## Containers

| Container | Content | Notes |
|---|---|---|
| `app` | NestJS serving `/api/v1/...` and the built Angular app | SQLite at `/data/app.db` on a volume. Icons and the seed file ship inside the image at `/app/data/`. Runs migrations at start. |
| `hardware-agent` | Python, about 40 lines | Reads the scanner, posts scans to `app` over the compose network, drives the feedback output from the response. |

## App layout

Plain NestJS modules, no CQRS. A controller calls a service; a service uses TypeORM repositories directly.

| Module | Responsibility |
|---|---|
| `scan` | Scan endpoint, scan rules, undo, history |
| `catalog` | Catalog items, sections, barcode mappings, inbox |
| `list` | List entries: to buy, recent, quantity, note |
| `connectors` | Product lookup behind one interface |
| `events` | Server-sent events to open pages |
| `log` | Keeps the last 500 log lines in memory, from the app itself and from the hardware agent, which posts its own lines to `POST /api/v1/logs`. `GET /api/v1/logs` returns them; new lines go out as `log` events. Lines are lost on restart |

Frontend pages: list, scan (camera), inbox with naming prompt, catalog, a management page per catalog item with its barcodes, history.

Barcodes are drawn in the browser by the existing `BarcodeComponent` (`apps/product-front/src/app/components/barcode/`). It handles 13-digit EAN codes today; 8-digit codes, which the scanner also reads, still need support.

## Data model

| Table | Columns | Notes |
|---|---|---|
| `section` | `id`, `name`, `sort_order`, `emoji` | Seeded from `data/seed-items.json` |
| `catalog_item` | `id`, `name` (unique), `section_id`, `icon`, `emoji`, `custom` | `icon` is a file name in the icon folder, served under `/icons/<icon>.png` |
| `barcode` | `code` (key), `catalog_item_id` (nullable), `suggestions` (JSON), `scan_count`, `last_scanned_at` | No catalog item means the barcode is in the inbox |
| `list_entry` | `catalog_item_id` (unique), `state` (`to_buy`, `recent`), `quantity`, `note`, `updated_at` | One entry per catalog item |
| `scan` | `id`, `code`, `source` (`handheld`, `phone`), `result`, `created_at`, `undone_at`, `catalog_item_id`, `previous_state`, `previous_quantity` | History and undo; the `previous_` columns hold what the list entry was before the scan |

On first start with an empty database, the app imports sections, items and the current list from `data/seed-items.json`.

## Scan rules

On `POST /api/v1/scans` with `{ code, source }`:

1. Same code within 3 seconds of the previous scan: result `ignored`.
2. Barcode has a catalog item:
   - entry is `to_buy`: quantity plus one, result `incremented`;
   - otherwise: state `to_buy`, quantity 1, result `added`.
3. Barcode has no catalog item: store the scan, query connectors if there are no suggestions yet, result `needs_name`.
4. Emit an event to open pages. Return the result, which the hardware agent turns into a feedback signal.

When a barcode gets its mapping, its waiting `needs_name` scans are applied by rule 2.

Checking off an entry sets state `recent` and quantity 0. Undo reverses the list change of the latest scan that is not undone.

## Connectors

```ts
interface ProductConnector {
    readonly id: string;
    lookup(code: string): Promise<ProductSuggestion | undefined>;
}

interface ProductSuggestion {
    connectorId: string;
    title: string;
    brand?: string;
    category?: string;
    imageUrl?: string;
}
```

- All enabled connectors run in parallel with a timeout of a few seconds. A failure or timeout yields no suggestion and is logged.
- The lookup runs in the background after the scan is answered, so a slow connector never delays the scanner. Results are stored on the barcode row, so a barcode is looked up once, and a `barcode` event tells open pages they arrived.
- `CONNECTORS` in `.env` picks the enabled ones (default `ah,off`).
- `category` is mapped to a shop section to prefill the naming prompt.
- Start: Albert Heijn (existing TypeScript connector, unofficial API) and Open Food Facts (official open API; send a descriptive User-Agent). Adding a source is one new class.

## API sketch

| Method and path | Purpose |
|---|---|
| `POST /api/v1/scans` | Register a scan |
| `POST /api/v1/scans/undo` | Undo the latest scan |
| `GET /api/v1/scans` | History |
| `GET /api/v1/list` | List entries with their catalog items |
| `PATCH /api/v1/list/:itemId` | State, quantity, note |
| `GET /api/v1/catalog`, `POST`, `PATCH /:id`, `DELETE /:id` | Catalog items |
| `GET /api/v1/catalog/:id` | One catalog item with its barcodes (number, suggestions, scan count, last scan) |
| `GET /api/v1/sections` | Shop sections in display order |
| `GET /api/v1/barcodes?unmapped=true` | Inbox |
| `GET /api/v1/barcodes/:code` | One barcode with its suggestions |
| `PUT /api/v1/barcodes/:code` | Set or change the mapping |
| `DELETE /api/v1/barcodes/:code` | Remove the mapping |
| `GET /api/v1/events` | Server-sent events: `scan`, `list`, `barcode`, `catalog`, and a `ping` every 25 seconds |
| `GET /icons/<icon>.png` | Icon files |
| `GET /api/v1/health` | Health check for Docker |

## Phone camera

- Needs HTTPS, which the proxy provides.
- The scanning phone is an iPhone. Safari on iOS has not offered `BarcodeDetector`, so plan on a JavaScript decoder library as the main path and use `BarcodeDetector` only where it exists. Verify on the actual iPhone early in milestone 4.
- Formats: EAN-13, EAN-8, UPC-A.

## Feedback output

The hardware agent maps a scan result to a signal: `added` and `incremented` to OK, `needs_name` to attention, an error or no response to error. Outputs are pluggable (`none`, buzzer, speaker), chosen by an environment variable. It starts as `none`.
