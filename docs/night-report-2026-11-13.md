# Night report, 2026-11-13

What was done between 01:13 and 02:10, while the owner slept. Nothing was pushed, released or changed on the Pi; `master` and the live version `1.0.16` are untouched.

## In one paragraph

The API restructure is finished on its branch and passes its tests, a local image build and a container smoke test. A review of the whole product is written, with 23 findings. Ten of them are built on six further branches, among them the read-only half of offline shopping; three have a written plan; seven are questions that need the owner. One real bug was found and fixed along the way. On the top branch: 17 unit tests, 37 integration tests and 22 agent tests pass.

## Branches

Stacked in this order; each contains the ones above it. All local, none pushed.

| Branch | Commits | Content | State |
|---|---|---|---|
| `feature/api-restructure` | 7 | The API in layers, one config class, one owner for the barcode table, transactions, caller kinds, route tests. Version `1.1.0` | Done, verified locally |
| `feature/product-review` | 1 | [product-review-2026-11-13.md](product-review-2026-11-13.md), [offline-plan.md](offline-plan.md) | Documents only |
| `feature/web-feedback` | 1 | Error toast for failed changes, toast with undo for handheld scans, undo for a check-off, event stream stops after logout | Done, checked in a browser |
| `feature/agent-tests-and-script-checks` | 1 | 20 tests for the hardware agent, shellcheck on the scripts, both in the build's checks job | Done; the workflow steps themselves run for the first time on GitHub |
| `feature/ops-visibility` | 3 | Security headers on every answer; backup result in the system log; first version of this report | Done; backup part unverified on the Pi |
| `feature/connector-failures` | 1 | The naming prompt says which lookup source gave no answer and can ask again | Done, checked in a browser |
| `feature/scanner-status` | 1 | The System page shows whether the scanner service and the scanner are there, and the last handheld scan | Done, checked in a browser with a simulated agent |
| `feature/offline-read` | 1 + this report | The app starts without a connection and shows the list as last loaded, read-only | Done, checked in desktop Chrome; not on a phone |

To release everything: fast-forward `master` to `feature/offline-read`. The last three branches are the riskiest to release unseen, in rising order; `feature/ops-visibility` is a sensible first stop. To release only the restructure: fast-forward to `feature/api-restructure`.

## Done

### API restructure (the agreed plan)

- All eight steps of [api-restructure-plan.md](api-restructure-plan.md), with its "Outcome" section listing commits and deviations.
- Tests went from 34 to 51 on this branch: 17 unit, 34 integration. New: a scan that fails halfway writes nothing; two scans at the same moment are handled in turn; the agent's token opens four routes only; the data routes accept and refuse the right input; the whole app module serves API, web app and icons.
- **Bug found by the new tests and fixed:** creating a product without a name answered 500 instead of 400. This bug is live in `1.0.16` too; it only shows when a request skips the web app's own check.
- Verified beyond the tests: the Docker image builds, and a container started from it seeds, writes its log file, serves pages and icons, and records a scan with the agent header as handheld and one without as phone.

### Product review

- [product-review-2026-11-13.md](product-review-2026-11-13.md): what is in good shape, 23 findings with a weight, and for each one whether it was built, planned or left as a question.
- Notable findings: failed actions in the web app were silent; use case 1 promised a toast for handheld scans that no code showed; the agent had no tests; a scan made while the app restarts is lost; the Pi runs whatever `master` holds as root.

### Built from the review

- **Failed changes are reported.** One interceptor shows an error toast; checked in Chrome by stopping the server and tapping a tile: "Geen verbinding: de wijziging is niet opgeslagen".
- **Handheld scans announce themselves on open pages**, with undo; an unknown barcode offers "Naam geven". Checked in Chrome with scans posted as the agent.
- **Undo for a check-off.** Checked in Chrome: tile left, toast appeared, undo brought it back.
- **Event stream stops after logout.** Built, not checked in a browser, since the test container ran with login off.
- **Agent tests**, 20, run with plain Python: `yarn hardware-agent:test`.
- **shellcheck** on the five shell scripts: one remark, silenced with a note; otherwise clean.
- **Security headers** on pages, icons and API answers; covered by a test.
- **Backup reports to the system log.** The report call and the failure trap were run against a local listener and send the right line, token and JSON. Not run on the Pi.

### Built after the first version of this report

- **Connector failures visible.** "No result" and "no answer" are now different: the barcode remembers which source failed, the naming prompt names it and offers "Opnieuw". Checked in Chrome with a container whose name lookups were cut off: "Geen antwoord van Albert Heijn, Open Food Facts". Marking such scans on the history page is not built.
- **Scanner state.** The agent reports whether it sees the scanner, on change and every minute; the System page shows "verbonden", "niet gevonden" or "scannerdienst niet bereikbaar", and the last handheld scan. Checked in Chrome by posting as the agent; the page followed the change live. Not run with the real agent and scanner.
- **Offline, read-only** (steps 1 and 2 of [offline-plan.md](offline-plan.md)). Checked in desktop Chrome: with the server stopped, a reload opened the app from the service worker's cache with all 16 tiles and their icons from the snapshot, the banner read "Geen verbinding met de server · lijst van 13 Nov 02:06", and a tap answered "Geen verbinding: de wijziging is niet opgeslagen". **This is the change to be most careful with**: a service worker that keeps files can also keep an old version or disturb the notification tap. The page itself always comes from the network when there is one, which limits that; the iPhone was not tested.

## Not done, and why

| Item | Why |
|---|---|
| Changing the list offline | Needs three choices by the owner and a phone in a shop; plan written |
| Tests for the web app | Needs a test runner, a new dependency with a long tail; plan written |
| Better shop-section guess | No data yet: three barcodes scanned so far; planned for after two weeks of use |
| Notification when the scanner stays away | Follows the scanner state; left until that is tried for real |
| Anything on the Pi | Agreed: read-only. Nothing was read either; it was not needed |
| Pushing branches | Agreed: local only |

## Questions waiting for the owner

Details and recommendations are in the review, section "Questions for the owner".

1. Scan history: keep forever or prune after a year?
2. A full content security policy: build it in report-only mode first?
3. Scans made while the app is unreachable: keep losing them, or hold and deliver later, with its own sound?
4. Branch protection and two-factor login for the GitHub account?
5. Dependabot for weekly dependency updates?
6. A licence for the public repository?
7. Automatic release notes per version?

And from the offline plan: stop after read-only offline or go on to queued changes at once; mark taps made offline; message when the server's state wins.

## Choices made without asking

Small ones, all reversible:

- Steps 3 and 4 of the restructure are one commit; the barcode service had to know about transactions from the start.
- The API layer may import entity types from the data layer; the lint rules forbid the outward directions.
- Log lines posted by the phone got their own source, "phone", with its own colour on the log page.
- The hardware agent keeps sending the scan source for now, so an update can never leave an old API with a new agent that omits it. The API ignores it.
- With login off, a request that carries the agent header counts as the agent.
- A test container on `localhost:3921` was used for the browser checks instead of a dev server, and removed afterwards, as were the test images. The browser's storage, cache and service worker for that address were cleared again.
- The offline snapshot is kept in local storage, not IndexedDB as the plan said: the data is small.
- The first run of the test container made the two connectors ask the real supermarket sites about one test barcode; later runs had their name lookups cut off on purpose.
- No new packages were added.

## To check after a release

1. The first build: the two new steps in the checks job (agent tests, shellcheck) and the arm64 image.
2. On the Pi: the scanner connects, a scan arrives and beeps, the sound settings load, agent lines show in the log.
3. A handheld scan with the app open on the phone: the toast with undo.
4. Check off a product: the toast, and undo.
5. After the next hourly backup with a change: "backup: pushed" in the system log.
6. The System page shows version `1.1.x`.
7. Naming prompt for a barcode scanned while a supermarket site is down: the "no answer" line. Hard to provoke; the system log shows "no answer from".
8. System page: "Handscanner: verbonden"; pull the dongle and it should read "niet gevonden" within seconds.
9. Offline: open the installed app once with a connection, switch the phone to flight mode, open the app again. Expect the list and the banner with its time. Then, with a connection, tap a notification for an unknown scan and check it still opens the inbox without a reload.
