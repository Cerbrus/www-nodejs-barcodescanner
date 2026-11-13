# Decisions

Outcome of the feature review on 2026-11-12, with later decisions added below. Change a decision here first, then in the other documents.

## Product

| # | Topic | Decision | Reason |
|---|---|---|---|
| 1 | List target | Own shopping list in this app. No Bring. | Bring has no quantity field, its API is unofficial, and the web page exists anyway. |
| 2 | Item naming | Generic name only ("Melk"). | Clean list. The variant is visible in the note if the user wants it. |
| 3 | First scan of a barcode | The user confirms the catalog item once; afterwards automatic. | Generic names can't be derived reliably from product titles. |
| 4 | Unknown barcode | Inbox only; nothing on the list until named. Web scan prompts at once. Handheld scan sends a notification to the phone; a sound signal is still planned. | The user chose a clean list over placeholders. |
| 5 | Lookup | A list of connectors behind one interface, all queried in parallel, every hit shown as a suggestion. Start with Albert Heijn and Open Food Facts. | The user picks the name anyway, so there is no reason to stop at the first hit, and one broken connector does no harm. |
| 6 | Repeat scan | Quantity counts up. Same barcode within 1 second is ignored (lowered from 3 seconds on 2026-11-12, so two cartons of the same product can be scanned right after each other). | Two empty cartons means buy two. |
| 7 | Categories | Own fixed set of shop sections, guessed for a new product from the connector suggestions and the name. | Sorting by section is the part of Bring worth keeping. |
| 8 | Icons | The user's own icon set in `data/icons/`, one file per item. Emoji, then a letter tile, as fallback. | Tiles with a real icon read faster than text. See "Icons" below. |
| 9 | Catalog | Seeded from `data/seed-items.json`: standard grocery items plus the user's own items, sections, notes and list state. | Naming is then usually one tap, and the new list starts where the old list left off. |
| 10 | Extras in version one | Scan history, undo last scan, mapping management. | Chosen by the user. |
| 11 | Left out | Store and price data, multiple lists, accounts with their own data, live sync between several phones. | Not needed for a single user. |
| 12 | Phone scan flow | Continuous scanning with undo toast. | Fastest when clearing several packages. |
| 13 | Offline | Online first with an offline banner; the page reconnects and reloads by itself. Offline support is a later milestone. | Sync is the largest single piece of work. |
| 14 | Sound feedback | Pluggable output in the hardware agent, `none` by default. First output: a buzzer on a GPIO pin (decided 2026-11-12, the user had one). The scanner's own beeper stays the preferred option if Tera documents it. | Costs nothing and needs no USB port. GPIO 14 is taken by the fan, so the buzzer goes on GPIO 18. |

## Platform

| # | Topic | Decision | Reason |
|---|---|---|---|
| 15 | Stack | Keep NestJS and Angular, trimmed hard. One app container serves the API and the built frontend. The API is layered: `api` (controllers, request types, guards), `core` (services, rules), `data` (entities, migrations), `config` (added 2026-11-13). | Familiar stack, far less code. One thing per file, and a fixed place for each kind of thing. |
| 16 | Removed | CQRS, mapper and repository layers, Slack-poll leftovers, the Python supermarket connector, PostgreSQL. Confirmed 2026-11-13 when the API got its layers: no class per use case, no separate domain models, no mappers. | Overhead for a home tool with a handful of tables. |
| 17 | Database | SQLite file on a Docker volume. | No database container; backup is one file. See "Database backup" below. |
| 18 | Scanner input | Small Python hardware agent container using `evdev` with an exclusive grab. | See "Scanner in Docker" below. |
| 19 | Deployment | Images built by GitHub Actions, pulled by a systemd timer on the Pi. | No inbound access, no SSH secrets, nothing but Docker on the Pi. |
| 20 | Access | Nginx Proxy Manager terminates HTTPS. Login is in the app, with Google, for the accounts on an allowlist (changed 2026-11-13; before that the proxy's access list did the login). | Camera scanning needs HTTPS. The proxy's access list turned out not to guard the site, and a basic-auth prompt is clumsy in a home-screen app. |
| 21 | Pi architecture | Raspberry Pi 3 Model B+, 64-bit Debian 13, about 900 MB memory. Build `linux/arm64` only. | Checked on the Pi on 2026-11-12. Memory is tight and shared with two other services, so nothing is built on the Pi and the image stays lean. |

## Scanner in Docker

Earlier attempts failed, most likely because the `keyboard` library needs root, scans all input devices and calls `dumpkeys`, which needs a console.

Chosen approach, proven on the Pi in milestone 1 (scans, replug and reboot):

- Read only the scanner's device, by its stable path `/dev/input/by-id/<scanner>-event-kbd`.
- Compose: bind-mount `/dev/input` read-only and set `device_cgroup_rules: ['c 13:* rmw']`. This also covers a replugged dongle, which a fixed `devices:` mapping does not. No `privileged`.
- Grab the device exclusively, so scans are not typed into the Pi's login console.
- Reopen the device in a loop when it disappears.

The fallback, running the same agent as a host systemd unit, was not needed.

## Icons

- Items use the user's own customised icon set: 353 PNG files in `data/icons/`, with English file names (`milk.png`, `toilet_paper.png`).
- An item's `icon` in `data/seed-items.json` is one of those file names without extension. `null` means no icon.
- Fallback order: icon file, emoji, letter tile. The app must work without the folder.
- Sections and items also carry an emoji. 350 of 358 items have one.
- The icons and `data/seed-items.json` are committed and ship inside the image. Only the database lives on the Pi's data volume.

## Repository visibility

The repository is public (decided 2026-11-12), and so are the images. Nothing secret goes into either: credentials live only in the `.env` file on the Pi.

## Database backup

Decided 2026-11-12: the Pi pushes an hourly SQL dump of the database to a private git repository, using a deploy key that only reaches that repository. Chosen over a cloud drive (extra tool and login) and over continuous replication (too heavy for a shopping list). Details in `deployment.md`.

## Notifications

Decided 2026-11-12: web push for unknown barcodes scanned with the handheld scanner, with the inbox count as app badge. No app store, no account: a service worker in the web app and the `web-push` package in the API. The service worker did not cache anything at first; since the offline work of 2026-11-13 it keeps the app's files, never API answers.

## Web app choices

Decided during the feedback rounds on 2026-11-12:

- Colours carry meaning on the list: red is to buy, green is recent.
- Appearance follows the device, with a switch for light or dark on the System page.
- New products can be created wherever a product is searched: in the naming prompt and in the list search.
- The camera decoder is `@zxing/browser`.
- Each lookup result shows the logo of its source, Albert Heijn or Open Food Facts, to credit where the information comes from. The two logo files are committed for that purpose only.
- Log files rotate at 256 KB with three old files kept; the page shows the last 500 lines.

## Version numbers

Decided 2026-11-12: versions are `major.minor.patch` with an automatic patch, the number of commits since `major.minor` was last raised in `package.json`, instead of bare commit hashes. The patch restarts at zero with every new minor or major version. Chosen over hand-bumped versions (easy to forget) and versions computed from commit messages (needs a strict message format). Each built commit gets a git tag. Details in `deployment.md`.

### How a notification tap opens the inbox

Settled on the iPhone on 2026-11-12, after three attempts:

- A service worker handling the tap does not work there: with the app in front, the phone never runs the handler.
- The declarative message format works: the phone opens the address in the message by itself. It does so as a page load, which restarted the app.
- Addresses after a `#` (`/#/inbox`) solve that: the phone treats the tap as a jump inside the open page. This is why the app uses hash addresses, although plain ones look nicer. Do not switch back without retesting the tap.

## Buzzer sounds

Decided 2026-11-12: the sound per scan result is a setting in the app, chosen from a fixed library, not hard-coded in the hardware agent. The user wanted to try sounds from the web page and pick per event. Free editing of own patterns was left out; new sounds are added to the library on request.

## Login

Decided 2026-11-13: login with Google inside the app, for the owner only. Considered and dropped for now: accounts for several people with their own lists and an approval step, as too complex. The allowlist can hold more addresses later; they would share the one list. No user table: the session is a signed cookie, and the hardware agent uses a shared secret.

## API hardening

Decided 2026-11-13, with the layered layout:

- A scan's source comes from who is calling, the agent's token or a browser session; it is not a field in the request. User types in the API may come some day; nothing is prepared for them.
- The agent's token opens four routes only.
- Each scan action is one transaction, and they run one at a time.
- Settings are read in one place.

## Repository housekeeping

Decided 2026-11-13:

- A handheld scan made while the app is unreachable is held by the agent and delivered later, with its own sound; it is not lost and should not be scanned again.
- Scan history is kept forever; nothing prunes it. The volume of a household is small, and undo, history and backup all stay simple.
- No licence file. The code is public to read; reuse is not granted.
- Dependency updates come as weekly pull requests from Dependabot: families that move together (Angular, Nx, NestJS, linting) as one pull request each, majors included; minor and patch versions of the rest grouped; other majors on their own. Changed on 2026-11-13 from leaving majors out: the owner has no objection to major versions, and the reviewer judges each one.
- Every version gets a GitHub release with the commit subjects since the previous version.
- A Claude agent reviews every Dependabot pull request once it is a day old: not only whether the checks pass, but whether the update changes or breaks what the product does. It repairs small things and leaves a verdict, so the owner only has to merge or not. It has no right to merge, a short list of tools, and treats changelogs as outside text.

## Node version

Decided 2026-11-13 by the owner: the images and the build follow the newest Node release, 25 at the time, also when it is not a long-term one. The build's tests run on the same version as the image. Local development works on 24 or newer.

## Owner and other accounts

Decided 2026-11-13: one account is the owner and alone gets the system parts of the System page; other accounts on the allowlist keep language, appearance, notifications for their device and their account. The server enforces it. Everything else stays shared for now: list, products, inbox. Whether other accounts later get their own list is undecided.

## Functional reference

Bring's web app remains a reference and source of inspiration for how the list page should behave.
