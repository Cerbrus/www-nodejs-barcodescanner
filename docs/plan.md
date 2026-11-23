# Plan

What is left, what was never tested, and what was done when. Decisions behind this plan are in [decisions/](decisions/README.md); how it works is in [architecture.md](architecture.md) and [deployment.md](deployment.md).

## Where it stands (2026-11-16, version 1.1.119)

In daily-use shape and running on the Pi:

- Handheld and camera scanning, the scan rules, inbox and naming with a proposed product and variant, the list with several lines per product told apart by their note, sections from the shop's category, product management, history with undo, the system log.
- Automatic updates from `master`, the firewall limit to the reverse proxy, an hourly database backup to a private repository. An open app reloads itself after an update. The Pi also runs the card scanner; the two updaters share a lock.
- Installable on the phone, Dutch and English, light and dark, push notifications for unknown handheld scans, shopping without a connection.
- Login with Google for an allowlist, with one owner account for the system parts. A buzzer at the scanner, with sounds built from blocks and one for a new version.
- Feedback from inside the app; the owner sends it to GitHub, where an agent implements it in a pull request; the owner's approval lands it through the release train, several at once as one version. A "What's new" page built from the releases.
- Tests: API rules and routes, the web app, 16 browser tests, the hardware agent, Prettier; all run before any image is published. Rollback by image tag was tested on 2026-11-15 and again on 2026-11-16, after the updater that skipped rollbacks was repaired.
- Packages: Node 26, Nx 24, Angular 22, TypeScript 6, NestJS 12, TypeORM 1, Tailwind 4, ngx-translate 18, ESLint 10. A content security policy in report-only mode.

## What comes next

1. **Content security policy to enforcing**: read the system log for "content policy" lines after a week of use (from 2026-11-20), fix what shows, then set `CSP_MODE=enforce` on the Pi.
2. **Daily use** (milestone 6): use it and fix what annoys. Most of this arrives through the feedback button.
3. **Milestone 13**, chosen by the owner on 2026-11-15, each part with its own plan before it is built:
    - **Command barcodes**: a printed sheet with codes the handheld scanner understands as commands, such as "undo the last scan", "the next scan counts down" and "the next scan goes on its own line", so the phone is not needed at the scanner.
    - **Siri shortcut**: "Hé Siri, zet melk op de lijst" calls the API with a token of its own and adds the product, matched by name with the naming rules.
    - **Share as text**: copy the products to buy as plain text, with notes and quantities.
    - **Merge products**: fold a duplicate product into another; its barcodes, list lines and history move along.
    - **Alerts to the owner**: a push notification when the scanner has been away for a while, the hourly backup fails, or a deploy does not come up healthy.
4. **Recipes**, asked for by the owner on 2026-11-23 and decided in [0100](decisions/0100-recipes-as-qr-codes.md) to [0107](decisions/0107-recipe-additions-wait-in-the-outbox.md). Built in six parts that each leave the app working, in this order:
    1. **`libs/shared`**: the library is set up and what the API and the web app both write today moves there ([0104](decisions/0104-shared-library.md)). Nothing behaves differently. Done 2026-11-23 12:57.
    2. **Hardware agent**: it rebuilds the typed text, posts barcodes and recipe codes and refuses the rest ([0106](decisions/0106-agent-posts-barcodes-and-recipe-codes.md)). Until part 5 the API refuses a recipe code. Done 2026-11-23 13:12.
    3. **Recipes in the app**: the tables and routes ([0105](decisions/0105-recipe-tables-and-routes.md)), the Recipes tab and pages with the Products page moved to the owner's Management group ([0101](decisions/0101-recipes-tab-and-pages.md)), and adding from the app with the tick sheet, the history line and undo ([0102](decisions/0102-putting-a-recipe-on-the-list.md)).
    4. **Codes**: the code on the recipe page, drawn by `qrcode-generator`, the select mode and the A4 sheet ([0103](decisions/0103-recipe-codes-printed-on-a4.md)).
    5. **Scanning codes**: the recipe rule behind `/scans`, the sounds `recipe` and `recipe_partial`, the push notification for a product the app does not know, the camera's tick sheet with a square frame, and recipe offers in the inbox.
    6. **Without a connection**: a recipe addition waits in the outbox ([0107](decisions/0107-recipe-additions-wait-in-the-outbox.md)).
5. **Later**: several accounts with working invites, replacing `ALLOWED_EMAILS` (milestone 10). It settles whether other accounts get their own list and what they may do with products and the inbox; for now those are shared.

Deferred or blocked:

- The AI suggestion for names (milestone 12, step 4): no paid API; the free options are in [archive/naming-plan.md](archive/naming-plan.md).
- TypeScript 7 (Angular 22's compiler and typescript-eslint accept TypeScript below 6.1 only) and better-sqlite3 13 (TypeORM 1 accepts up to 12).
- Angular's build tools 22.3 (`@angular/build`, `@angular/cli`, `@angular-devkit/build-angular`): they stay at 22.2 while the rest of Angular is at 22.3. Nx 24.0.6, the newest, loads `@angular-devkit/architect/node/index.js`, a path that architect 0.2203 no longer exposes, so every Angular target fails before it starts. Dependabot skips 22.3 and up for these three (`.github/dependabot.yml`); remove that when an Nx release loads `@angular-devkit/architect/node` (seen 2026-11-23).
- Real tones at the scanner: a passive buzzer or a small speaker; the hardware agent already supports a passive buzzer. No speaker for now (owner, 2026-11-15).

Not chosen (owner, 2026-11-15): "due again" suggestions, a "done shopping" action with trimming of recent, section order per shop, prices from the shop, shop photos as icons, multiple lists.

## Known and unexplained

- The page once froze on the iPhone after an unknown camera scan. The likely cause, the camera decoding behind the dialog, is removed; it has not happened since, but it was never reproduced either.
- The scanner sometimes reads one code twice within two seconds. The repeat pause is 1 second, so a double read more than a second apart counts twice and needs an undo.

## Never tested

- The restore procedure on a second machine. A dump was loaded into a scratch database on the Pi and matched the live row counts.
- A reboot with the firewall service since it was added.
- Push notifications in a desktop browser, which takes the service worker path.
- The view of an account that is not the owner, on the live site: tried only in a local container with a test session.
- The content security policy in enforcing mode.
- The release train starting by itself from an approval, also of a Dependabot pull request: its first run was started by hand. The railway wording and pictures of its messages, the "left on the platform" and "derailed" comments, and the removal of the waiting builds: tried only on a scratch repository with a stand-in for GitHub. The removal now waits for those builds to appear, and a release tells its pull requests and their issues in a comment: both tried only with a stand-in for `gh`.
- The released and live stages of a remark on the Feedback page: tested against a stand-in for GitHub only. Not seen with the real tags and compare endpoint, nor whether the merge commit of a pull request landed by the train is a commit on `master`.
- The agent on an issue that someone else wrote.
- The train leaving a pull request with failing checks behind, the agent rebasing a pull request that conflicted, and an approval carried over that rebase: built on 2026-11-20, tried only on a scratch repository. The repair after failed checks ran once for real, on pull request 43.
- A request for changes sending a pull request back to the agent: built on 2026-11-20. Only the script that collects the owner's remarks was tried, with a stand-in for `gh`; the start from a review and the agent's revision have not run.

Not planned, no hardware for it (owner, 2026-11-15): `install.sh` on a fresh Pi, and push notifications on Android.

## Done

Every entry carries the date and time it was reached, local time. The plans, reports and reviews behind them are in [archive/](archive/), and the plan as it was until 2026-11-16, with every step, is [archive/plan-until-2026-11-16.md](archive/plan-until-2026-11-16.md).

| What | Done | Released |
|---|---|---|
| 0. Clean start | 2026-11-12 14:46 | |
| 1. Scanner spike on the Pi: the hardware agent in an unprivileged container | 2026-11-12 15:47 | |
| 2. Pull-based deployment | 2026-11-12 16:15 | |
| 3. Backend core: SQLite, scan rules, connectors, events | 2026-11-12 16:53 | |
| 5. Catalog and icons: seed, icon picker, section guess | 2026-11-12 18:49 | |
| 4. Frontend: list, scan, inbox, products, history, log, System | 2026-11-12 19:09 | |
| 7. Feedback at the scanner: push for unknown scans, buzzer on GPIO 18 | 2026-11-12 23:40 | |
| 6. Login with Google, agent token | 2026-11-13 00:32 | |
| 6. API restructured into layers and hardened ([plan](archive/api-restructure-plan.md)) | 2026-11-13 01:27 | 1.1 |
| 6. Held scans while the app is unreachable | 2026-11-13 19:03 | 1.1.11 |
| 8. Offline shopping ([plan](archive/offline-plan.md)) | 2026-11-13 20:10 | 1.1.17 |
| 10. Owner account, system parts for the owner only | 2026-11-13 20:12 | 1.1.26 |
| Packages: Nx 24, Angular 22, TypeScript 6, forty unused packages removed | 2026-11-13 20:22 | 1.1.26 |
| 6. An open app reloads itself after an update | 2026-11-13 21:40 | 1.1.29 |
| 6. Content security policy in report-only mode | 2026-11-13 22:28 | 1.1.32 |
| 9. Tests for the web app and the end-to-end run | 2026-11-14 00:26 | 1.1.40 |
| 11. Remarks from inside the app, and the agent on GitHub ([plan](archive/remarks-plan.md)) | 2026-11-15 01:09 | 1.1.48 |
| 6. Shared lock for the two updaters on the Pi | 2026-11-15 02:28 | 1.1.57 |
| "What's new" page | 2026-11-15 12:04 | 1.1.63 |
| 12. Names, sections and variants, steps 1 to 3 ([plan](archive/naming-plan.md)) | 2026-11-15 15:45 | 1.1.77 |
| Packages: web-push 4, ESLint 10, ngx-translate 18, Tailwind 4, NestJS 12, TypeORM 1 | 2026-11-15 16:21 | 1.1.87 |
| Rollback test, 1.1.87 to 1.1.77 and back | 2026-11-15 17:00 | |
| 7. The buzzer announces a new version | 2026-11-15 17:27 | 1.1.93 |
| 14. Scanner sounds from blocks ([plan](archive/sounds-plan.md)) | 2026-11-15 18:45 | 1.1.93, changes up to 1.1.101 |
| Updates every minute, pulling only when the registry has new images | 2026-11-16 02:30 | 1.1.102 |
| Node 26 | 2026-11-16 12:59 | 1.1.119 |
| Review of 2026-11-15 and 16 worked through ([review](archive/review-2026-11-16.md)); rollback test again at 17:54 | 2026-11-16 18:07 | 1.1.106, 1.1.110, 1.1.115 |
| Only the repository's admin role may push to `master` | 2026-11-16 18:34 | |
| The owner's checks after the review, on the iPhone: push since web-push 4, the variant in the naming prompt, a fast second tap on the list | 2026-11-16 18:48 | |
| Finished plans, reports and reviews moved to `docs/archive/`, this plan shortened | 2026-11-16 18:48 | |
| The update sound for a newer version only: confirmed by the owner | 2026-11-16 18:51 | 1.1.115 |
| Release train: an approval lands a pull request, several as one version; the agent starts for any issue the owner labels | 2026-11-20 14:58 | 1.1.128 |
| Train started by an approval: pull request 42 landed, 43 left behind on a conflict in two lines of documentation | 2026-11-20 16:42 | 1.1.134 |
| First train, started by hand: pull requests 37 and 39 rebased, checked together and landed as one version; GitHub marked both merged and closed their issues | 2026-11-20 15:10 | 1.1.130 |
| A review that requests changes sends a pull request back to the agent, with the owner's remarks from the pull request | 2026-11-20 17:40 | |
| Slow start in the shop: the app opens from the kept page and the remembered login without waiting for the network, the iPhone shows a launch image, and a server that does not answer within 5 seconds counts as no connection. Checked by the owner on the iPhone with the Pi's port blocked | 2026-11-23 11:17 | 1.2.16 |
| Loading over a weak connection: answers compressed, files with a version in their name kept by the service worker and the browser, the icon font from 4.0 MB to 8 KB. Checked by the owner on the live site | 2026-11-23 11:49 | 1.2.18 |
| Recipes, part 1: the shared library `libs/shared` holds what the API and the web app both wrote | 2026-11-23 12:57 | 1.2.28 |
| Recipes, part 2: the hardware agent rebuilds the typed text, posts barcodes and recipe codes and refuses the rest | 2026-11-23 13:12 | |
