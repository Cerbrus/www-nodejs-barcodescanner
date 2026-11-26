# Decisions

One record per decision, in the MADR layout. Read this page first; open a record when its row is what you need. The old single page is kept in [../archive/decisions-until-2026-11-20.md](../archive/decisions-until-2026-11-20.md).

## Rules

- A decision is never rewritten. A changed decision is a new record that says "Supersedes" and gets the next number; the old record gets the status "superseded by NNNN" and points to the new one.
- Status is one of: accepted, superseded by NNNN, dropped.
- Each record has: status, date, who decided, context, the options weighed, the decision, the consequences. "Not recorded" means the old text did not say.
- Records marked "found afterwards" are choices that were made but never written down; their date and the person who decided are not known. Their source is named in the context.
- To change a decision: add the new record, mark the old one, add a row here, then change the affected documents.
- Number the next record 0122 or higher: the highest number plus one.

## Product

| Number                                          | Title                                                                                            | Status                      | Date         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------- | ------------ |
| [0001](0001-own-shopping-list.md)               | Own shopping list, no Bring                                                                      | accepted                    | 2026-11-12   |
| [0002](0002-generic-item-names.md)              | Items carry a generic name only                                                                  | accepted                    | 2026-11-12   |
| [0003](0003-confirm-first-scan.md)              | The user confirms the catalog item at the first scan of a barcode                                | accepted                    | 2026-11-12   |
| [0004](0004-unknown-barcode-inbox.md)           | An unknown barcode goes to the inbox                                                             | accepted                    | 2026-11-12   |
| [0005](0005-parallel-connectors.md)             | Product lookup through parallel connectors                                                       | accepted                    | 2026-11-12   |
| [0006](0006-repeat-scan-3-seconds.md)           | A repeat scan counts up, the same barcode within 3 seconds is ignored                            | superseded by 0007          | 2026-11-12   |
| [0007](0007-repeat-scan-1-second.md)            | The repeat window is 1 second                                                                    | accepted                    | 2026-11-12   |
| [0008](0008-fixed-shop-sections.md)             | A fixed set of shop sections                                                                     | accepted                    | 2026-11-12   |
| [0009](0009-own-icon-set.md)                    | The user's own icon set, with emoji and letter tile as fallback                                  | accepted                    | 2026-11-12   |
| [0010](0010-seeded-catalog.md)                  | The catalog is seeded from a file                                                                | accepted                    | 2026-11-12   |
| [0011](0011-extras-version-one.md)              | Extras in version one: history, undo, mapping management                                         | accepted                    | 2026-11-12   |
| [0012](0012-left-out-of-scope.md)               | Left out: store and price data, multiple lists, accounts with own data, live sync                | accepted                    | 2026-11-12   |
| [0013](0013-continuous-phone-scan.md)           | Continuous scanning on the phone with an undo toast                                              | accepted                    | 2026-11-12   |
| [0014](0014-online-first.md)                    | Online first, offline later                                                                      | accepted                    | 2026-11-12   |
| [0040](0040-history-kept-forever.md)            | Scan history is kept forever                                                                     | accepted                    | 2026-11-13   |
| [0056](0056-naming-sections-variants.md)        | Names, sections and variants of scanned products                                                 | accepted                    | 2026-11-15   |
| [0057](0057-list-entry-ids-and-variants.md)     | List entries have their own id; product plus note is unique                                      | accepted                    | 2026-11-15   |
| [0058](0058-bring-as-reference.md)              | Bring's web app is a functional reference                                                        | accepted                    | not recorded |
| [0080](0080-failures-never-fail-a-scan.md)      | A connector failure or a failed push never fails a scan                                          | accepted (found afterwards) | not recorded |
| [0090](0090-lookup-in-background.md)            | The product lookup runs in the background after the scan is answered                             | accepted (found afterwards) | not recorded |
| [0100](0100-recipes-as-qr-codes.md)             | A recipe is a QR code that carries its whole ingredient list                                     | accepted                    | 2026-11-23   |
| [0102](0102-putting-a-recipe-on-the-list.md)    | A recipe goes on the list at once or through a tick sheet, and counts as one line in the history | accepted                    | 2026-11-23   |
| [0108](0108-collect-toggle-on-the-scan-page.md) | A toggle on the scan page makes a phone scan collect the product from the list                   | accepted                    | 2026-11-23   |

## Scanner and sounds

| Number                                                | Title                                                                               | Status             | Date       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------ | ---------- |
| [0015](0015-sound-feedback-buzzer.md)                 | Sound feedback: a pluggable output, first a buzzer on GPIO 18                       | accepted           | 2026-11-12 |
| [0016](0016-hardware-agent-evdev.md)                  | A small Python hardware agent with evdev                                            | accepted           | 2026-11-12 |
| [0017](0017-buzzer-sound-per-event.md)                | The sound per scan result is a setting, from a fixed library                        | superseded by 0020 | 2026-11-12 |
| [0018](0018-buzzer-announces-version.md)              | The buzzer announces a new version once it is live                                  | superseded by 0019 | 2026-11-15 |
| [0019](0019-announce-only-higher-version.md)          | Only a version higher than the last announced one is announced                      | accepted           | 2026-11-16 |
| [0020](0020-sounds-from-building-blocks.md)           | Sounds are built from blocks and kept as presets                                    | accepted           | 2026-11-15 |
| [0021](0021-agent-holds-offline-scans.md)             | The agent holds a scan made while the app is unreachable                            | accepted           | 2026-11-13 |
| [0106](0106-agent-posts-barcodes-and-recipe-codes.md) | The hardware agent rebuilds the typed text and posts only barcodes and recipe codes | accepted           | 2026-11-23 |

## Notifications

| Number                                          | Title                                                     | Status   | Date       |
| ----------------------------------------------- | --------------------------------------------------------- | -------- | ---------- |
| [0022](0022-web-push.md)                        | Web push for unknown handheld scans                       | accepted | 2026-11-12 |
| [0023](0023-notification-tap-hash-addresses.md) | A notification tap opens the inbox through hash addresses | accepted | 2026-11-12 |

## Platform and build

| Number                                             | Title                                                                                    | Status                      | Date         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| [0024](0024-stack-nestjs-angular.md)               | Keep NestJS and Angular, trimmed hard, one app container                                 | accepted                    | 2026-11-12   |
| [0025](0025-api-layers.md)                         | The API is layered: api, core, data, config                                              | accepted                    | 2026-11-13   |
| [0026](0026-removed-overhead.md)                   | Removed: CQRS, mappers, repository layers, Slack leftovers, Python connector, PostgreSQL | accepted                    | 2026-11-12   |
| [0027](0027-sqlite.md)                             | SQLite on a Docker volume                                                                | accepted                    | 2026-11-12   |
| [0032](0032-newest-node.md)                        | Images and build follow the newest Node release                                          | accepted                    | 2026-11-13   |
| [0038](0038-prettier.md)                           | Prettier formats the code and lint checks it                                             | accepted                    | 2026-11-15   |
| [0078](0078-migrations-only.md)                    | Schema changes only through migrations, synchronize off                                  | accepted (found afterwards) | not recorded |
| [0079](0079-one-thing-per-file-and-table-owner.md) | One thing per file, one owning service per table, transactions through TransactionRunner | accepted (found afterwards) | not recorded |
| [0083](0083-yarn-nx-monorepo.md)                   | Yarn and Nx for the monorepo                                                             | accepted (found afterwards) | not recorded |
| [0104](0104-shared-library.md)                     | Code that the API and the web app both need lives in `libs/shared`                       | accepted                    | 2026-11-23   |
| [0105](0105-recipe-tables-and-routes.md)           | Recipe tables, routes, and how a recipe is kept in the scan history                      | accepted                    | 2026-11-23   |
| [0084](0084-build-gates.md)                        | The build runs lint, all tests and the end-to-end test first                             | accepted (found afterwards) | not recorded |
| [0085](0085-strict-lint-rules.md)                  | Strict lint rules                                                                        | accepted (found afterwards) | not recorded |
| [0086](0086-no-explanatory-comments.md)            | No explanatory comments in the code                                                      | accepted (found afterwards) | not recorded |
| [0087](0087-test-tools.md)                         | Vitest for the web app, Playwright with the installed Chrome for end to end              | accepted (found afterwards) | not recorded |
| [0095](0095-validated-request-types.md)            | Requests are validated with class-validator under /api/v1                                | accepted (found afterwards) | not recorded |
| [0097](0097-docs-in-docs-folder.md)                | Documentation lives in docs/, finished plans in docs/archive/                            | accepted (found afterwards) | not recorded |

## Delivery and repository

| Number                                     | Title                                                                                   | Status                      | Date         |
| ------------------------------------------ | --------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| [0028](0028-pull-based-deployment.md)      | Images built by GitHub Actions, pulled by a timer on the Pi                             | accepted                    | 2026-11-12   |
| [0029](0029-pi-arm64-only.md)              | Raspberry Pi 3 B+, images for linux/arm64 only                                          | accepted                    | 2026-11-12   |
| [0030](0030-hourly-backup.md)              | Hourly SQL dump pushed to a private repository                                          | accepted                    | 2026-11-12   |
| [0031](0031-public-repository.md)          | The repository and the images are public                                                | accepted                    | 2026-11-12   |
| [0033](0033-automatic-version-numbers.md)  | Versions are major.minor.patch with an automatic patch                                  | accepted                    | 2026-11-12   |
| [0034](0034-github-release-per-version.md) | Every version gets a GitHub release                                                     | accepted                    | 2026-11-13   |
| [0035](0035-dependabot-with-majors.md)     | Dependabot: weekly pull requests, majors included                                       | superseded by 0036          | 2026-11-13   |
| [0036](0036-dependabot-without-majors.md)  | Dependabot leaves major versions of npm packages out                                    | accepted                    | 2026-11-16   |
| [0037](0037-claude-reviews-dependabot.md)  | A Claude agent reviews every Dependabot pull request                                    | accepted                    | 2026-11-13   |
| [0039](0039-no-licence-file.md)            | No licence file                                                                         | accepted                    | 2026-11-13   |
| [0091](0091-firewall-to-proxy-only.md)     | The app's port is closed to everything but the reverse proxy                            | accepted (found afterwards) | not recorded |
| [0092](0092-updater-checks-and-lock.md)    | The updater does nothing when nothing changed, and shares a lock with the other updater | accepted (found afterwards) | not recorded |
| [0093](0093-rollback-by-image-tag.md)      | Rollback by setting IMAGE_TAG in .env                                                   | accepted (found afterwards) | not recorded |
| [0121](0121-shared-dependabot-reviewer.md) | The Dependabot reviewer is a shared workflow                                            | accepted                    | 2026-11-26   |

## Access and security

| Number                                          | Title                                                                  | Status                      | Date         |
| ----------------------------------------------- | ---------------------------------------------------------------------- | --------------------------- | ------------ |
| [0041](0041-access-by-proxy-list.md)            | Access through the reverse proxy's access list                         | superseded by 0042          | 2026-11-12   |
| [0042](0042-login-with-google.md)               | Login with Google inside the app, for an allowlist                     | accepted                    | 2026-11-13   |
| [0043](0043-accounts-with-own-lists-dropped.md) | Accounts for several people with their own lists, dropped for now      | dropped                     | 2026-11-13   |
| [0044](0044-api-hardening.md)                   | API hardening with the layered layout                                  | accepted                    | 2026-11-13   |
| [0045](0045-owner-and-other-accounts.md)        | One owner account gets the system parts, other accounts share the rest | accepted                    | 2026-11-13   |
| [0046](0046-content-security-policy.md)         | Content security policy, first in report-only mode                     | accepted                    | 2026-11-13   |
| [0047](0047-light-branch-protection.md)         | Light protection for master: no deletion, no force-push                | superseded by 0048          | 2026-11-13   |
| [0048](0048-only-admin-pushes-master.md)        | Only the admin role may push to master                                 | accepted                    | 2026-11-16   |
| [0082](0082-routes-closed-by-default.md)        | Routes are for logged-in users by default                              | accepted (found afterwards) | not recorded |

## Web app

| Number                                                    | Title                                                                                    | Status                      | Date         |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------- | ------------ |
| [0049](0049-colours-carry-meaning.md)                     | Colours carry meaning on the list                                                        | accepted                    | 2026-11-12   |
| [0050](0050-appearance-follows-device.md)                 | Appearance follows the device, with a switch                                             | accepted                    | 2026-11-12   |
| [0051](0051-create-products-anywhere.md)                  | New products can be created wherever a product is searched                               | accepted                    | 2026-11-12   |
| [0052](0052-zxing-camera-decoder.md)                      | The camera decoder is @zxing/browser                                                     | accepted                    | 2026-11-12   |
| [0053](0053-source-logos.md)                              | Each lookup result shows the logo of its source                                          | accepted                    | 2026-11-12   |
| [0054](0054-log-rotation.md)                              | Log files rotate at 256 KB, three old files kept                                         | accepted                    | 2026-11-12   |
| [0055](0055-changelog-in-app.md)                          | A changelog in the app, written from the git history                                     | accepted                    | 2026-11-15   |
| [0081](0081-offline-snapshot-and-outbox.md)               | Offline list: a snapshot and an outbox, the server wins on conflict                      | accepted (found afterwards) | not recorded |
| [0107](0107-recipe-additions-wait-in-the-outbox.md)       | Without a connection, a recipe addition waits in the outbox                              | accepted                    | 2026-11-23   |
| [0088](0088-angular-signals-translations.md)              | Angular with standalone components, signals, Dutch and English texts                     | accepted (found afterwards) | not recorded |
| [0089](0089-tailwind-and-css-variables.md)                | Tailwind 4 with every colour a CSS variable                                              | accepted (found afterwards) | not recorded |
| [0094](0094-server-sent-events.md)                        | Open pages follow the server through a server-sent event stream                          | accepted (found afterwards) | not recorded |
| [0099](0099-templates-and-styles-in-own-files.md)         | Every component keeps its template and styles in its own files                           | accepted                    | 2026-11-20   |
| [0101](0101-recipes-tab-and-pages.md)                     | Recipes get their own tab; the Products page moves to the owner's part of System         | accepted                    | 2026-11-23   |
| [0103](0103-recipe-codes-printed-on-a4.md)                | Recipe codes are printed on A4, twelve to a page                                         | superseded by 0109          | 2026-11-23   |
| [0109](0109-cut-marks-at-the-page-edge.md)                | The sheet of recipe codes has cut marks at the page edge, no lines between the codes     | accepted                    | 2026-11-23   |
| [0110](0110-offline-recipe-addition-is-always-applied.md) | A recipe addition made without a connection is always applied, at the moment it was made | accepted                    | 2026-11-23   |
| [0111](0111-buttons-show-an-icon-only.md)                 | Buttons show an icon only, and each kind of action has one icon                          | accepted                    | 2026-11-24   |
| [0120](0120-themes-beside-light-and-dark.md)              | Themes beside light and dark: colours, fonts and shape                                   | accepted                    | 2026-11-25   |
| [0112](0112-pull-down-to-refresh.md)                      | Pulling a page down reloads it                                                           | accepted                    | 2026-11-24   |

## Release train

| Number                                         | Title                                                                | Status   | Date       |
| ---------------------------------------------- | -------------------------------------------------------------------- | -------- | ---------- |
| [0059](0059-release-train.md)                  | The owner's approval lands pull requests through a release train     | accepted | 2026-11-20 |
| [0060](0060-conflict-back-to-agent.md)         | A conflicting pull request of the agent goes back to the agent       | accepted | 2026-11-20 |
| [0061](0061-hot-box.md)                        | A pull request whose own checks fail is left behind (hot box)        | accepted | 2026-11-20 |
| [0062](0062-train-token.md)                    | The train moves master with a limited token of the owner's account   | accepted | 2026-11-20 |
| [0063](0063-train-railway-names.md)            | The train speaks in steam-era railway terms                          | accepted | 2026-11-20 |
| [0115](0115-labels-on-pull-requests.md)        | Pull requests get their labels by themselves                         | accepted | 2026-11-25 |
| [0116](0116-last-call-counts-who-can-board.md) | The last call waits only for pull requests that can board            | accepted | 2026-11-24 |
| [0117](0117-train-images-are-published.md)     | The images the release train built are the ones that get published   | accepted | 2026-11-24 |
| [0118](0118-images-built-beside-the-checks.md) | The images are built beside the checks and get their tags after them | accepted | 2026-11-24 |

## Remarks and the agent

| Number                                                  | Title                                                                             | Status                      | Date         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- | ------------ |
| [0064](0064-remarks-in-own-database.md)                 | Remarks are stored in the app's own database; only the owner sends them to GitHub | accepted                    | 2026-11-15   |
| [0065](0065-let-the-agent-look-at-it.md)                | "Let the agent look at it" is the first option and ticked by default              | accepted                    | 2026-11-15   |
| [0066](0066-reject-is-soft-delete.md)                   | Rejecting a remark is a soft delete                                               | accepted                    | 2026-11-15   |
| [0067](0067-edit-remark-until-sent.md)                  | A remark can be edited until it is on GitHub                                      | accepted                    | 2026-11-20   |
| [0068](0068-remark-progress-from-github.md)             | The Feedback page shows the progress of a sent remark, read from the GitHub API   | accepted                    | 2026-11-20   |
| [0069](0069-remark-kinds.md)                            | Remarks come as bug, wish or note                                                 | accepted                    | 2026-11-15   |
| [0070](0070-no-touch-and-hold.md)                       | No touch and hold for pointing at the app                                         | accepted                    | 2026-11-15   |
| [0071](0071-bottom-menu-pointable.md)                   | The bottom menu can be pointed at                                                 | accepted                    | 2026-11-15   |
| [0072](0072-feedback-page-layout.md)                    | Feedback page: handled remarks collapsed, actions top right, Ctrl+Enter           | accepted                    | 2026-11-15   |
| [0073](0073-no-screenshots.md)                          | No screenshots in remarks                                                         | accepted                    | 2026-11-15   |
| [0074](0074-no-two-finger-tap.md)                       | No two-finger tap; pointing mode is the only way on the phone                     | accepted                    | 2026-11-15   |
| [0075](0075-agent-implements-owner-issues.md)           | The agent implements issues the owner wrote                                       | superseded by 0076          | 2026-11-15   |
| [0076](0076-agent-for-any-labelled-issue.md)            | The agent starts for any issue the owner labels                                   | accepted                    | 2026-11-20   |
| [0077](0077-agent-repairs-failed-checks-once.md)        | The agent repairs a failed build once                                             | accepted                    | 2026-11-20   |
| [0119](0119-workflow-sets-the-agents-labels.md)         | The workflow sets the agent's labels, read from its comment                       | accepted                    | 2026-11-25   |
| [0098](0098-request-changes-back-to-agent.md)           | A request for changes sends the pull request back to the agent                    | accepted                    | 2026-11-20   |
| [0113](0113-agent-estimates-complexity-and-severity.md) | The agent estimates complexity and severity                                       | accepted                    | 2026-11-24   |
| [0114](0114-agent-verifies-a-bug-report.md)             | The agent verifies a bug report and rejects one it proved false                   | accepted                    | 2026-11-24   |
| [0096](0096-remark-not-feedback.md)                     | In the code, feedback from inside the app is called a remark                      | accepted (found afterwards) | not recorded |
