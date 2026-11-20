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
| 14 | Sound feedback | Pluggable output in the hardware agent, `none` by default. First output: a buzzer on a GPIO pin (decided 2026-11-12, the user had one). The scanner's own beeper is off the table: Tera answered on 2026-11-16 that the scanner does not support beeps or lights started by the host. | Costs nothing and needs no USB port. GPIO 14 is taken by the fan, so the buzzer goes on GPIO 18. |

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

Decided 2026-11-15, on the owner's wish: the buzzer announces a new version once it is live, with a sound chosen like the scan sounds. The app keeps the highest version it announced in `data/announced-version`. Changed 2026-11-16, by the owner after the review: only a version higher than that one is announced. A rollback, the way back from it and a first install stay silent; until then any version other than the last announced one played the sound.

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
- Dependency updates come as weekly pull requests from Dependabot: families that move together (Angular, Nx, NestJS, linting) as one pull request each; minor and patch versions of the rest grouped. Major versions of npm packages are left out and done by hand; the Docker base images and the GitHub Actions still get them, and a security fix comes whatever its version. Changed on 2026-11-16 from including majors, which was itself a change of 2026-11-13: they came as a row of separate pull requests that break the build, and a major version of Angular or Nx needs its migration tooling, which Dependabot does not run.
- Every version gets a GitHub release with the commit subjects since the previous version.
- Decided 2026-11-15: Prettier formats the code and `yarn lint:all` checks it. The choices: single quotes, 120 characters, 4 spaces, LF, no trailing commas, `bracketSameLine` off, and the Angular parser for HTML, so templates keep their control flow blocks readable. The one commit that reformatted everything is named in `.git-blame-ignore-revs`.
- A Claude agent reviews every Dependabot pull request once it is a day old: not only whether the checks pass, but whether the update changes or breaks what the product does. It repairs small things and leaves a verdict, so the owner only has to merge or not. It has no right to merge, a short list of tools, and treats changelogs as outside text.

## Changelog in the app

Decided 2026-11-15, on the owner's issue #23: the app shows a changelog to every logged-in account, a summary line per version with date and time, expanding into its notes. The data is a file in the web app, written from the git history by `tools/changelog.mjs`, notes in English. Chosen over an API route and a table (nothing to store). Changed in review the same day: the build writes the file just before the image is made, including the version being built, instead of a committed file that was refreshed by hand and so always lacked the newest version.

## Node version

Decided 2026-11-13 by the owner: the images and the build follow the newest Node release, 25 at the time, also when it is not a long-term one. The build's tests run on the same version as the image. Local development works on 24 or newer.

## Owner and other accounts

Decided 2026-11-13: one account is the owner and alone gets the system parts of the System page; other accounts on the allowlist keep language, appearance, notifications for their device and their account. The server enforces it. Everything else stays shared for now: list, products, inbox. Whether other accounts later get their own list is undecided.

## Content security policy

Decided 2026-11-13: the policy starts in report-only mode and reports go to the existing system log, not to a file or table of their own. After a week of use without reports the owner sets `CSP_MODE=enforce` on the Pi; no release is needed for that step, and `report` is the way back. The policy does not allow `eval`, and the former message format library (`@messageformat/core`) needs it by design. It was replaced by FormatJS `intl-messageformat`, the replacement its own maintainers name; the translation files did not change. Angular's built-in translation was weighed and dropped: it builds one app per language and cannot switch language while running.

## Branch rules

Decided 2026-11-13: light protection for `master`, as a repository ruleset: no deletion, no force-push. No required pull request or checks, because there is no second person to review and releases are direct pushes.

Changed 2026-11-16, by the owner: only the repository's admin role may push to `master`; the ruleset got the rule against updates, with that role as the exception. The reason: the Dependabot reviewer installs proposed package versions while it holds a token that may write to the repository, and the Pi fetches and runs `update.sh` and `firewall.sh` from `master` every minute, so a malicious package release could otherwise reach the Pi through a push to `master`. Decided by the owner on 2026-11-16: the reviewer stays as it is and keeps running package code with its tokens present; that finding is dismissed.

## Release train

Decided 2026-11-20, by the owner: a pull request is no longer finished and landed by hand. The owner's approval is the manual step, and it is also the selection: every pull request he approved at its current commit rides along. The release train then rebases them onto `master` one after another, runs every check on the result and moves `master` to it, so several pull requests come out as one version.

- The train leaves when no open pull request is left without his approval, and at the latest 5 minutes after the approval that started it. A run by hand from the Actions page leaves at once and can be limited to chosen pull requests; those still need his approval.
- A pull request that conflicts with `master` or with one ahead of it drops out with a comment, and the others go on. When the checks on the whole train fail, nothing is merged and every pull request on it is told; they stay approved for the next train.
- Left out, to land by hand: a pull request from a fork, and one that changes a workflow file.
- The checks run twice, on the train and again in the build that follows the push. The first run keeps a failing combination off `master`; the second is the build that publishes.
- The train moves `master` with a token of the owner's account, limited to this repository, to its contents and its pull requests, and without the right to change workflow files. It is a secret of the environment `release`, which only runs from `master` can use, so a pull request cannot reach it; the job that runs the pull requests' code never gets it. This widens what was narrowed on 2026-11-16: a stored secret can now write to `master`. Accepted, because nothing reaches `master` without the owner's approval of that exact commit.
- GitHub's own merge queue does this, but only for a repository owned by an organisation. Moving the repository was weighed and dropped: the image names, the workflows' owner checks and the Pi's settings would all change.
- Changes the line of 2026-11-15 that the owner lands the agent's pull requests himself. The agent still never merges.
- The train speaks in steam-era railway terms (owner, 2026-11-20): the workflows, jobs, run summary and comments carry punning names and emoji, a drawn picture per state, and one line that shows the train with a carriage per pull request (`🚂-🚃#37-🚃#39`). Every message still says in a plain sentence what happened and what to do. No pull request numbers in the pictures: that needs a picture per run. Period engravings were weighed and dropped for the drawn set, which covers every state and reads on a light and a dark page.

## Remarks from inside the app

Decided 2026-11-15, see [remarks-plan.md](archive/remarks-plan.md) for the reasoning:

- Remarks are stored in the app's own database. Every account may write them and sees its own; the owner sees all.
- Only the owner sends a remark to GitHub, after seeing what goes out; the repository is public, so this step is the privacy gate. The account and the device details stay out unless ticked.
- Changed 2026-11-15, on the owner's issue #26: "Let the agent look at it" is the first option when sending to GitHub and ticked by default. Each such issue starts an agent run on the owner's Claude plan unless he unticks it.
- Rejecting a remark is a soft delete, decided 2026-11-15 on the owner's answer: state `rejected`, hidden from every list, the row kept. The owner rejects any remark, a writer only their own; a remark already on GitHub cannot be rejected.
- Progress of a sent remark (owner, 2026-11-20, issue #38): the Feedback page shows the state of the issue on GitHub and the pull request's number and title, read from the GitHub API by the server and cached for a minute. No webhook and no table: nothing to store, and the state cannot go stale in the database.
- Kinds: bug, wish and note. The writer gets a thank-you, no promise and no state.
- No touch and hold: it collides with scrolling and with what the iPhone does on a long touch. Pointing mode on the phone, right click on a computer.
- The bottom menu can be pointed at too (owner, 2026-11-15, issue #11): right click on a tab, and in pointing mode a tap on the active tab picks it, while a tap on another tab navigates.
- The Feedback page (owner, 2026-11-15, issue #25): handled remarks are collapsed as a group behind one "handled" item, not one by one. A remark's actions sit at its top right: one action as a button, two or more under a ⋮ menu, Handle included. The form sends with Ctrl+Enter, and closing it with text in it asks to cancel, close (keeping the text) or close and reset.
- No screenshots: a page cannot take a real picture of itself. The part pointed at is recorded as data.
- Changed 2026-11-15, on the owner's issue #10: no two-finger tap. It did not work for the owner, so pointing mode is the only way on the phone.
- An agent on GitHub handles an issue the owner labels. Changed 2026-11-15, after the first four issues all ended in questions: an issue from the owner is his decision and carries his authority, so the agent implements it in a pull request unless a real question is open, also when it overrules an earlier decision, and labels the issue with its verdict. It never merges. Changed again 2026-11-15, after its first pull request: the pull request is opened ready for review, not as a draft, and the owner is code owner of the whole repository.
- Changed 2026-11-20, by the owner: the agent starts for any issue the owner labels, also one that someone else wrote. Setting the label is his approval of what the issue asked at that moment, so the agent works from the text as it was then, not from a later edit by its writer, and still counts only the owner's comments. Until then the issue had to be written by the owner's account too.

## Names, sections and variants of scanned products

Decided 2026-11-15, see [naming-plan.md](archive/naming-plan.md): naming an unknown barcode offers the most specific existing product found in the shop title, else a more generic one with the rest as note, else a new name without brand and amount; a language model would make that suggestion, the rules otherwise; that AI step is deferred (owner, 2026-11-15) until the rules prove too weak, and only a free service counts, see the options in naming-plan.md. A product can be on the list several times, told apart by its note, which is the variant; a barcode can carry that variant. The section of a new product comes from the shop's category first.

Built 2026-11-15 (step 2): a list entry has its own id, a UUID the web app makes, so an entry added without a connection needs no answer from the server. Product plus note is unique; when a change gives an entry the note of another entry of the same product, the server merges them, quantities added when both are to buy. The search on the list page shows every line of a found product that is to buy, with its note and "+1", and a plain tile that starts a new line when the product has no line without a note (owner, 2026-11-15). A scan of a barcode with a variant adds to the entry of that product with that note.

## Scanner sounds from building blocks

Decided 2026-11-15, see [sounds-plan.md](archive/sounds-plan.md): sounds are built from beep, pause, trill and buzz blocks for the active buzzer (no pitch), at most 1 second (halved from 2 by the owner on 2026-11-15) with as many blocks as fit in it (the cap of 12 dropped by the owner on 2026-11-15), kept as named presets in the database. The fixed list of sounds goes, the soft sounds included; a preset in use cannot be deleted. A speaker or passive buzzer for real tones is shelved.

## Functional reference

Bring's web app remains a reference and source of inspiration for how the list page should behave.
