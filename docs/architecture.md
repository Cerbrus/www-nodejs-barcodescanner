# Architecture

How the product is built today. What is still open is in [plan.md](plan.md).

```
 handheld scanner          phone / browser
        │ USB dongle              │ HTTPS
        ▼                         ▼
┌────────────────┐        ┌─────────────────────┐
│ hardware-agent │        │ Nginx Proxy Manager │  certificate
│ Python, evdev  │        └──────────┬──────────┘
└───────┬────────┘                   │
        │ POST /api/v1/scans         ▼
        │                 ┌─────────────────────────────┐      ┌───────────────────┐
        └────────────────►│ app (one container)         │─────►│ product connectors│
                          │ NestJS: API + Angular files │      │ AH, Open Food     │
                          │ SQLite on /data             │      │ Facts, ...        │
                          └──────┬───────────────┬──────┘      └───────────────────┘
                                 │               │
                                 ▼               ▼
                       push services      private backup repository
                       (Apple, Google)    (hourly SQL dump, by a host timer)
```

## Containers

| Container | Content | Notes |
|---|---|---|
| `app` | NestJS serving `/api/v1/...` and the built Angular app | SQLite at `/data/app.db` on a volume. Icons and the seed file ship inside the image at `/app/data/`. Runs migrations at start. |
| `hardware-agent` | Python, one file | Reads the scanner, posts scans and its own log lines to `app` over the compose network. Retries while the app is starting. Beeps a buzzer on a GPIO pin according to the scan result, when one is configured. |

## App layout

Plain NestJS modules, no CQRS. A controller calls a service; a service uses TypeORM repositories directly.

| Module | Responsibility |
|---|---|
| `scan` | Scan endpoint, scan rules, undo, history |
| `catalog` | Catalog items, sections, barcode mappings, inbox |
| `list` | List entries: to buy, recent, quantity, note |
| `connectors` | Product lookup behind one interface |
| `auth` | Login with Google for the accounts on an allowlist, the session cookie, and the guard in front of every route |
| `events` | Server-sent events to open pages |
| `log` | Keeps the last 500 log lines in memory, from the app itself and from the hardware agent, which posts its own lines to `POST /api/v1/logs`. `GET /api/v1/logs` returns them; new lines go out as `log` events. Every line is also appended to `/data/logs/app.log`, which rotates at 256 KB and keeps three old files; the last 500 lines are read back at start, so the log survives restarts and updates |
| `feedback` | The library of buzzer sounds, the sound chosen per scan result, and test sounds relayed to the hardware agent |
| `push` | Web push notifications: keeps the subscriptions of devices that turned notifications on, and sends a notification when the handheld scanner reads a barcode without a name. Creates its own key pair in `/data/push-keys.json` on first use |

The app also serves the icon files under `/icons` and the built web app for every other path.

## Web app

Angular with standalone components and signals; no state library. `apps/product-front/src/app/`:

| Folder | Content |
|---|---|
| `pages/` | `login`, `list`, `scan` (camera), `inbox`, `catalog` (products), `item` (one product with its barcodes), `history`, `log`, `system` |
| `components/` | `shell` (navigation, offline banner, toasts), `item-tile`, `item-icon`, `sheet` (modal dialog), `item-autocomplete`, `new-item-form`, `naming-prompt`, `icon-picker`, `barcode` |
| `services/` | `auth.service` (login state, route guard), `api.service` (HTTP), `events.service` (live stream), `shopping.store` (sections, items, list and inbox as signals), `push.service`, `theme.service`, `toast.service` |

- `shopping.store` loads everything once and reloads on events from the server, so every open page follows scans made elsewhere.
- Dialogs use the native `<dialog>` element, so they sit above the navigation.
- Barcodes are drawn in the browser by `BarcodeComponent`: EAN-13, EAN-8, and 12-digit codes padded to 13.
- New products get a guessed shop section from keywords in the connector suggestions and the name (`new-item-form`).
- Texts: `@ngx-translate`, Dutch by default and English, in `assets/i18n/`. Language and theme are stored in the browser.
- Theme: every colour is a CSS variable in `styles.scss`. Dark follows the device unless the user picks light or dark, which sets `data-theme` on the page.
- Addresses use the part after `#` (`/#/list`, `/#/inbox`). A notification's address then differs from the open page only after the `#`, which a browser treats as a jump inside the page instead of a new page load. An old address without `#` is rewritten at start.
- `index.html` paints the page background in the right theme and the outline of the navigation bar before the scripts run, so a cold start or reload does not flash an empty screen.
- Installable: `assets/manifest.webmanifest`, the home-screen icons and the titles in `index.html`.
- `src/sw.js` is the service worker. It only handles notifications and caches nothing.

## Data model

| Table | Columns | Notes |
|---|---|---|
| `section` | `id`, `name`, `sort_order`, `emoji` | Seeded from `data/seed-items.json` |
| `catalog_item` | `id`, `name` (unique), `section_id`, `icon`, `emoji`, `custom` | `icon` is a file name in the icon folder, served under `/icons/<icon>.png` |
| `barcode` | `code` (key), `catalog_item_id` (nullable), `suggestions` (JSON), `scan_count`, `last_scanned_at` | No catalog item means the barcode is in the inbox |
| `list_entry` | `catalog_item_id` (unique), `state` (`to_buy`, `recent`), `quantity`, `note`, `updated_at` | One entry per catalog item |
| `scan` | `id`, `code`, `source` (`handheld`, `phone`), `result`, `created_at`, `undone_at`, `catalog_item_id`, `previous_state`, `previous_quantity` | History and undo; the `previous_` columns hold what the list entry was before the scan |
| `feedback_setting` | `event` (key), `sound_id` | Chosen buzzer sound per scan result; no row means the default |
| `push_subscription` | `endpoint` (key), `p256dh`, `auth`, `language`, `origin`, `created_at` | One row per device with notifications on; removed when the push service reports it gone |

On first start with an empty database, the app imports sections, items and the current list from `data/seed-items.json`.

## Scan rules

On `POST /api/v1/scans` with `{ code, source }`:

1. Same code within 1 second of the previous scan: result `ignored`. The camera page has its own, longer pause of 3 seconds for a code that stays in view.
2. Barcode has a catalog item:
   - entry is `to_buy`: quantity plus one, result `incremented`;
   - otherwise: state `to_buy`, quantity 1, result `added`.
3. Barcode has no catalog item: store the scan, query connectors if there are no suggestions yet, result `needs_name`.
4. Emit an event to open pages and return the result. For a `needs_name` scan from the handheld scanner, send a notification once the lookup is done.

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
- `category` and `title` feed the section guess in the naming prompt.
- Built: Albert Heijn (unofficial API, anonymous token) and Open Food Facts (official open API, with a generic User-Agent). Adding a source is one new class, plus its logo in `apps/product-front/src/assets/connectors/` and a line in the naming prompt's connector table; without a logo the prompt shows the connector's id as text.

## API

| Method and path | Purpose |
|---|---|
| `POST /api/v1/scans` | Register a scan |
| `POST /api/v1/scans/undo` | Undo the latest scan |
| `GET /api/v1/scans` | History |
| `GET /api/v1/list` | List entries with their catalog items |
| `PATCH /api/v1/list/:itemId` | State, quantity, note |
| `GET /api/v1/catalog`, `POST`, `PATCH /:id`, `DELETE /:id` | Catalog items |
| `GET /api/v1/catalog/:id` | One catalog item with its barcodes (number, suggestions, scan count, last scan) and `defaultIcon`, the icon the seed file gives a product of that name |
| `GET /api/v1/sections` | Shop sections in display order |
| `GET /api/v1/barcodes?unmapped=true` | Inbox |
| `GET /api/v1/barcodes/:code` | One barcode with its suggestions |
| `PUT /api/v1/barcodes/:code` | Set or change the mapping |
| `DELETE /api/v1/barcodes/:code` | Remove the mapping |
| `GET /api/v1/events` | Server-sent events: `scan`, `list`, `barcode`, `catalog`, `log`, `feedback`, `feedback_settings`, and a `ping` every 25 seconds |
| `GET /icons/<icon>.png` | Icon files |
| `GET /api/v1/icons` | Names of the available icons, for the icon picker |
| `POST /api/v1/barcodes/:code/discard` | Cancel the waiting scans of an unnamed barcode and drop it from the inbox |
| `GET /api/v1/feedback/settings` | The sound chosen per event, and the library of sounds |
| `PUT /api/v1/feedback/settings/:event` | Choose the sound for an event, or `none` |
| `POST /api/v1/feedback/test` | Play one sound from the library at the scanner |
| `GET /api/v1/logs`, `POST` | The latest log lines; the hardware agent posts its own |
| `GET /api/v1/push/key` | Public key a browser needs to subscribe to notifications |
| `POST /api/v1/push/subscriptions`, `DELETE` | Store or remove this device's subscription |
| `POST /api/v1/push/test` | Send a test notification to every subscribed device |
| `GET /api/v1/auth/me` | Whether login is on, and who is logged in |
| `GET /api/v1/auth/google`, `GET /api/v1/auth/google/callback` | Start and finish of the Google login |
| `POST /api/v1/auth/logout` | End the session |
| `GET /api/v1/health` | Status, version, commit and build time; also Docker's health check |

## Login

Optional, switched on by setting `GOOGLE_CLIENT_ID`. Without it the API is open to whoever can reach it and the reverse proxy is the only guard.

- **Flow**: the login page links to `GET /api/v1/auth/google`, which sends the browser to Google with a random state kept in a short-lived cookie. Google returns to `/api/v1/auth/google/callback`; the API checks the state, exchanges the code with Google using the client secret, and reads the account from the answer. The account must have a verified address that is listed in `ALLOWED_EMAILS`.
- **Session**: a cookie holding the address and an expiry, signed with a secret the app creates in `/data/session-secret`. No session table. It lasts 90 days and is renewed when the app is opened after a day or more. `HttpOnly`, `Secure`, `SameSite=Lax`. Removing an address from `ALLOWED_EMAILS` ends its sessions at once.
- **Guard**: one global guard covers every API route and the event stream. Open without login: the health check and the `auth` routes. The files of the web app and the icons are public; they hold no data.
- **Hardware agent**: has no Google account. It sends the `AGENT_TOKEN` from `.env` in the `X-Agent-Token` header, which the guard accepts instead of a session.
- **Other sites**: a request that changes something and names another site as its origin is refused.
- **Web app**: a route guard asks `GET /api/v1/auth/me` once; without a session it shows the login page. Any "not logged in" answer later sends the user there too. The System page shows the account and a logout button.
- No passwords, no user table, no roles: everyone on the allowlist shares the one list.

## Staying connected

The page listens to `/api/v1/events`. When that stream ends for good, which happens when the app restarts during an update or the proxy answers with an error page, the page opens a new one every 3 seconds until it works. It also reconnects when the browser reports the network is back, and when the page returns to the foreground after 40 seconds without a ping. After every reconnect and every return to the foreground it reloads its data, and a failed load is retried every 5 seconds. The "no connection" banner is shown in between.

## Notifications

Web push, so it works with the app closed. The frontend registers a small service worker (`/sw.js`, no caching) that shows the notification, sets the number on the app icon, and opens the inbox when tapped. A tap stores the page to open in a small cache entry and wakes the app; the app reads the entry when it gets the message, when it returns to the foreground, when it starts, and every 1.5 seconds while it is visible. A message alone is not enough: on the iPhone it did not arrive, with the app in the background or in front. Each tap also writes a line to the system log.

- Message format: declarative web push (`"web_push": 8030` with a `notification` that carries title, body, badge and the address to open). A browser that knows the format, Safari from iOS 18.4, shows the notification and opens the address itself, without the service worker; that is what makes a tap open the inbox on the iPhone, where the service worker's own tap handling did not. Other browsers hand the same message to the service worker, which shows it and handles the tap. The address needs the site's own origin, which each device sends along when it subscribes.
- Sent when: a scan from the handheld scanner ends in `needs_name`. Scans from the phone camera do not notify; the phone is already showing the naming prompt. The notification goes out after the connector lookup, so it can name the product the supermarket knows for that barcode.
- Content: title, the suggested product name with the barcode, and the number of barcodes in the inbox as badge. Texts are Dutch or English, following the language the device had when it subscribed.
- The badge is also set by the open app whenever the inbox changes. With the app closed it only changes when a notification arrives, because every push must show a notification.
- iPhone: only for the site installed on the home screen (iOS 16.4 or later), and permission must be asked from a tap, which the System page does.
- The server only makes outgoing calls to the push service of the browser maker (Apple, Google, Mozilla). A failure is logged and never fails a scan.

## Phone camera

- Needs HTTPS, which the proxy provides.
- Decoding is done in JavaScript by `@zxing/browser`, because Safari on iOS offers no `BarcodeDetector`. Confirmed working on the iPhone and on a laptop.
- The frame on screen is only a guide; the decoder reads the whole picture.
- The camera stops while the naming prompt is open and restarts after.
- Formats: EAN-13, EAN-8, UPC-A. A code can also be typed.

## Feedback at the scanner

The hardware agent turns the result of each scan into a sound on a buzzer connected to a GPIO pin of the Pi. Which sound belongs to which result is chosen on the System page.

| Event | Default sound |
|---|---|
| `added` | short beep |
| `incremented` | two blips |
| `needs_name` | long beep |
| `error`: scan not delivered or rejected | three beeps |
| `ignored`: repeat within the debounce | none |

- **Sounds** are lists of steps: `on` and `off` with a length, and `gate`, which switches the buzzer on and off many times a second. An active buzzer has one fixed pitch, so gating is what gives it other sounds: a trill at 5 to 30 times a second, a rough buzz at a few hundred, a softer tone with a short on-time. The library of sounds is `apps/product-api/src/feedback/sounds.ts`; a new sound is one line there plus its name in both language files.
- **Settings**: the `feedback_setting` table holds the chosen sound per event; an event without a row uses the default, and `none` means silent. The System page shows a dropdown per event and a button per sound to listen to it.
- **Agent**: fetches the settings, with the steps of each chosen sound, when it connects to the event stream and again on a `feedback_settings` event, and keeps them in memory. So a scan that cannot reach the API still gets its error sound. Before the first contact it uses the built-in defaults.
- **Test**: `POST /api/v1/feedback/test` sends a sound as a `feedback` event, which the agent plays at once.
- `FEEDBACK_OUTPUT` picks the output: `none` (default) or `buzzer`. Another output, such as a speaker, would be another class next to `Buzzer`. A passive buzzer gets a square wave made in software.
- The pin is driven through the kernel's GPIO character device (`/dev/gpiochip0`) with `libgpiod`; the container gets that one device and stays unprivileged.
- Sounds play on their own thread, so a beep never delays reading the next scan. A buzzer that cannot be opened is logged once and the agent carries on without sound.
- `python3 agent.py --test-feedback` plays the sound of every event once.

## Backup

Outside the containers: a timer on the Pi dumps the database as SQL and pushes it to a private repository. See [deployment.md](deployment.md).
