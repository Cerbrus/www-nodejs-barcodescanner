# Product review, 2026-11-13

A review of the whole product after its first two days: the web app, the API, the hardware agent, deployment and the documentation. It lists what is in good shape, what is weak or missing, and what happens with each finding: built in the night of 2026-11-13 on a feature branch, planned, or left as a question for the owner.

Method: reading the code and documents, running the tests and builds, comparing the use cases with what the code does, and the facts collected on the Pi during the build days. Nothing here was judged on a phone or with the scanner.

## In good shape

- **The core loop works and is tested.** Scan rules are a pure, tested function; scan actions are transactions since the restructure; 51 tests cover the rules, the services, the login guard and the data routes.
- **Deployment is hands-off.** A push builds, numbers and tags a version; the Pi follows by itself; the database is backed up hourly to a private repository.
- **Access is closed.** Login with Google for an allowlist, a narrow token for the agent, a firewall rule in front of the port; probed from outside the app.
- **Documentation matches the code.** Use cases, architecture, deployment, decisions and plan are current, and "never tested" is listed honestly.
- **Failures of the outside world do not break scanning.** Connectors, push and the buzzer are all isolated.

## Findings

Weight: **A** affects daily use or safety, **B** worth doing, **C** nice to have.

### Web app

| # | Finding | Weight | What happens |
|---|---|---|---|
| W1 | A failed action is silent. 26 places send a change to the server without handling failure; only the scan page shows an error. Tap a tile during an update or without signal and nothing happens, with no message. | A | Built: branch `feature/web-feedback` |
| W2 | Use case UC-1 says any open page shows a toast with an undo button after a handheld scan. No code does that; the page only refreshes its data. | A | Built: `feature/web-feedback` |
| W3 | Checking off is one tap on a tile, so a mis-tap happens, and there is no undo except finding the tile under "recent". | B | Built: `feature/web-feedback` |
| W4 | After logout or an expired session the page keeps trying to reopen the event stream every 3 seconds, forever. | C | Built: `feature/web-feedback` |
| W5 | The web app has no automated tests at all. Every change is checked by hand, mostly by the owner on the phone. | B | Planned, see "Plans" |
| W6 | Shopping without a connection (milestone 8) is not built; in a shop with poor signal the list does not load. | A | Planned in [offline-plan.md](offline-plan.md); needs the owner's choices |
| W7 | No one has checked the pages with a screen reader or at large text sizes. | C | Noted |

### API and data

| # | Finding | Weight | What happens |
|---|---|---|---|
| A1 | The `scan` table grows without end; every scan is kept forever. Small today, but it is also in every hourly backup. | C | Question 1 |
| A2 | Responses carry no security headers: nothing forbids framing the site or guessing content types. | B | Built: the safe headers, on `feature/ops-visibility`. A content security policy is question 2 |
| A3 | Lookup failures of the product connectors are only in the system log (open item of milestone 6). In the naming prompt "no result" and "Albert Heijn did not answer" look the same. | B | Built after the first report: branch `feature/connector-failures` |
| A4 | The shop section for a new product is guessed from a short keyword list in the web app (open item of milestone 5). | C | Planned, see "Plans" |
| A5 | The login routes have no rate limit. Low risk: the password check is Google's, and a session cannot be guessed. | C | Noted |

### Hardware agent

| # | Finding | Weight | What happens |
|---|---|---|---|
| H1 | The agent has no tests. Its key reading, its sound patterns and its settings handling were only tried by hand. | B | Built: branch `feature/agent-tests-and-script-checks` |
| H2 | A scan made while the app is unreachable is lost: the agent beeps the error sound and forgets the scan. The app restarts at every update, about 15 seconds each. | B | Question 3 |
| H3 | Nothing shows whether the scanner is connected, short of reading the system log. A dongle that fell out is noticed when a scan does not arrive. | B | Planned, see "Plans" |
| H4 | The agent still sends the scan source, which the API now ignores. | C | Remove one release after 1.1.0 |

### Deployment and operations

| # | Finding | Weight | What happens |
|---|---|---|---|
| O1 | A failed backup is invisible unless someone reads the journal on the Pi. | B | Built: `feature/ops-visibility`; unverified on the Pi |
| O2 | The shell scripts that run as root on the Pi are not checked by any tool. | B | Built: `feature/agent-tests-and-script-checks` |
| O3 | The Pi runs, as root, whatever `master` holds: the updater fetches its own scripts from the repository. Whoever can push to `master` controls the Pi. | A | Question 4 |
| O4 | No automatic updates of dependencies; versions are whatever was current on 2026-11-12. | B | Question 5 |
| O5 | The repository is public and has no licence file, so legally nobody may reuse it, and the two connector logos sit next to code without a note on their status. | C | Question 6 |
| O6 | `install.sh`, the restore procedure and rollback were never run for real. | B | Stays on the "never tested" list; needs a spare SD card |
| O7 | Versions have numbers and tags but no notes: what changed in 1.0.14 is only in commit messages. | C | Question 7 |

### Documentation

| # | Finding | Weight | What happens |
|---|---|---|---|
| D1 | UC-1 describes the toast that did not exist (W2). | B | Fixed by building W2 |
| D2 | The README has no picture of the product. | C | Noted; needs screenshots from a phone |

## Built tonight

Each on its own branch, stacked in this order on `feature/api-restructure`. Nothing is on `master`. What was verified and how is in [night-report-2026-11-13.md](night-report-2026-11-13.md).

### `feature/web-feedback`

- **W1** One place that reports failed changes: an HTTP interceptor shows an error toast when a request that changes something fails, with a distinct text for "no connection", "already exists" and "not found". Reads stay silent, as the offline banner covers them.
- **W2** The scan event carries its source; the shell shows the toast with undo for scans that came from the handheld scanner. Scans made on the same page keep their own toast.
- **W3** Checking off shows a toast with "undo", which puts the product back with its quantity and note.
- **W4** The event stream stops retrying once the user is logged out.

### `feature/agent-tests-and-script-checks`

- **H1** Tests for the agent with a fake keyboard device and a fake GPIO: digits and Enter become one scan, scans without an end key, non-digit keys, sound steps for an active and a passive buzzer, settings loading. Run in the `checks` job.
- **O2** `shellcheck` on the four deployment scripts and the version script in the `checks` job, with its findings fixed.

### `feature/ops-visibility`

- **O1** `backup.sh` reports its result to the system log through the API, using the agent's token: "backup: pushed", "backup: nothing changed", "backup failed: ...".
- **A2** Headers on every response: no framing by other sites, no content-type guessing, a strict referrer policy.

## Plans

Not built; each needs either a choice by the owner or a phone to judge.

### Offline shopping (W6)

See [offline-plan.md](offline-plan.md).

### Tests for the web app (W5)

1. Add a test runner for the web app that needs no browser: Vitest with Angular's test bed, or Jest. This is a new development dependency.
2. First tests where the logic is: `ShoppingStore` (grouping, refresh on events, failure flag), `ItemAutocompleteComponent` (ranking, create option), `EventsService` (reconnect rules), the barcode drawing (check digits).
3. Add them to the `checks` job.
4. Later: one end-to-end run in a headless browser against the built image (log in off, scan by typing a code, name it, check off).

Why not built tonight: choosing and wiring a test runner into an Nx workspace is a decision with a long tail, and step 4 needs the image build in CI to be extended.

### Connector failures visible (A3)

1. `lookupAll` returns, per connector, a result, "no result" or "failed".
2. The barcode row stores the failed connector ids next to the suggestions (new column, new migration).
3. The naming prompt and the inbox show "Albert Heijn did not answer" with a "try again" button that repeats the lookup.
4. The history page marks scans whose lookup failed.

### Better section guess (A4)

1. Collect the category texts both connectors really return; the Pi's database holds them for every barcode scanned so far.
2. Move the guess to the API as a table from category to section, with the keyword list as fallback.
3. Return the guessed section with the barcode, so every client agrees.

Why not built tonight: with three scanned barcodes there is no data to build the table from. Worth doing after two weeks of use.

### Scanner state on the System page (H3)

1. The agent reports "scanner connected" and "scanner waiting" to a small status route, and keeps its event stream open even without a buzzer.
2. The API remembers the agent's last report and whether its stream is open.
3. The System page shows: agent connected or not, scanner connected or not, time of the last handheld scan.
4. Optional: a notification when the scanner has been gone for more than a few minutes.

## Questions for the owner

Each with a recommendation. Nothing was done on these.

Answers of 2026-11-13: 1 keep forever; 3 hold and deliver with its own sound; 5 yes, weekly and grouped; 6 no licence; 7 yes. Questions 2 and 4 are open.

1. **Scan history: keep forever, or prune?** Recommendation: keep the last 12 months, pruned once a day; undo only ever needs the latest scan. Parked because it deletes data.
2. **Content security policy.** A strict policy would stop any injected script, but it has to allow the product photos from the supermarket sites, the icon font and the inline start-up script, and a mistake shows as a blank page. Recommendation: build it in report-only mode first, read the reports for a week, then enforce.
3. **Scans while the app is unreachable.** Options: keep today's behaviour (error beep, scan lost); or let the agent hold such scans and deliver them when the app is back. With the second, someone who hears the error beep and scans again gets the product counted twice. Recommendation: hold and deliver, with a different sound ("held, will be added") than the error sound.
4. **Who can change what runs on the Pi.** Recommendation: turn on branch protection for `master` and two-factor login on the GitHub account, both account settings; no code change.
5. **Automatic dependency updates.** Recommendation: Dependabot, weekly, grouped into one pull request for minor and patch versions. It opens pull requests on the repository by itself, which is why it was not switched on.
6. **Licence.** Recommendation: MIT for the code, and a line in the README that the two connector logos belong to their owners and are shown to credit the source.
7. **Release notes.** Recommendation: let the workflow create a GitHub release for every version tag, with the commit subjects since the previous tag as text.
