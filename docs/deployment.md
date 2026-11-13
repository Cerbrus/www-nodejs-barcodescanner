# Deployment

How the product runs on the Raspberry Pi. Everything here is in place on the server Pi; what was never tested on a fresh one is listed in [plan.md](plan.md).

## Principle

The Pi pulls; nothing pushes to the Pi.

1. A push to `master` makes GitHub Actions build the `app` and `hardware-agent` images and publish them to GitHub's container registry (`ghcr.io`), tagged `latest`, with the version number and with the commit hash.
2. A systemd timer on the Pi runs every 5 minutes: fetch the compose file, pull images, restart what changed.
3. The Pi needs Docker and outbound internet, plus `git` and `sqlite3` for the backup. No inbound port for deployment, no SSH key in GitHub, no Node or Python on the Pi.

The repository and the images are public, so the Pi needs no GitHub token and no registry login. Set each image package to public once on GitHub after the first build; new packages start private even in a public repository. Secrets never go into an image.

## The server Pi

Checked over SSH on 2026-11-12:

| Fact | Value |
|---|---|
| Model | Raspberry Pi 3 Model B+ |
| OS | Debian 13 (trixie), 64-bit (`aarch64`) |
| Memory | about 900 MB, plus the same amount of swap; roughly 600 MB available |
| Disk | 10 GB free |
| Docker | Engine 29.9.3 and compose plugin v5.7.1, installed 2026-11-12 from Docker's Debian repository |
| Other services | `recipes` and `webserver` (ports 3000 and 3010), `fan-control` |
| Port 3020 | free |
| Network | wired and wifi interface; point the proxy at the wired address |
| Scanner dongle | `/dev/input/by-id/usb-0581_011c-event-kbd` |
| Memory limits | available since 2026-11-12: `cgroup_enable=memory cgroup_memory=1` added to `/boot/firmware/cmdline.txt` (backup next to it) |

Consequences:

- Build `linux/arm64` images only.
- The install script must install Docker Engine and the compose plugin on a fresh Pi; on this one they are present.
- Memory is tight, so nothing is built on the Pi.
- Every container in the compose file gets a memory limit, so the app cannot starve the other services. A fresh Pi needs the kernel parameters above before limits work; the install script adds them and asks for a reboot.

## On the Pi

```
/opt/barcodescanner/
|-- docker-compose.yml    # fetched from the repo by the updater
|-- update.sh             # the updater; refreshes itself and the two scripts below
|-- firewall.sh           # limits the app's port to the reverse proxy
|-- backup.sh             # database backup to the private repository
|-- backup_key(.pub)      # SSH key that only reaches the backup repository
|-- backup/               # working copy of the backup repository
|-- .env                  # local settings and secrets, never overwritten, readable by root only
`-- data/                 # owned by user 1000
    |-- app.db            # SQLite database
    |-- push-keys.json    # key pair for notifications
    |-- session-secret    # signs the login cookies
    `-- logs/app.log      # log file with its rotated files
```

Systemd units: `barcodescanner-update.timer` (every 5 minutes), `barcodescanner-backup.timer` (hourly), `barcodescanner-firewall.service` (at boot).

One-time install on a fresh Pi:

```bash
curl -fsSLO https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment/install.sh
sudo bash install.sh
```

`deployment/install.sh` can be run again safely. It:

1. installs Docker Engine and the compose plugin, `git` and `sqlite3` if they are missing;
2. adds the kernel parameters for container memory limits if they are missing (needs one reboot);
3. creates `/opt/barcodescanner/` with `data/`, the three scripts and an `.env` from `deployment/env.template`, filling in the scanner device when one is plugged in;
4. creates the backup key and prints its public half;
5. installs and starts `barcodescanner-update.timer` (2 minutes after boot, then every 5 minutes), `barcodescanner-backup.timer` (hourly) and `barcodescanner-firewall.service`;
6. runs the updater once.

After the first install, fill in `.env` (next sections): `ALLOWED_SOURCE`, `BACKUP_REPO`, `PUSH_SUBJECT`.

The updater, `deployment/update.sh`, fetches the current `docker-compose.yml`, its own newer version and the newer `firewall.sh` and `backup.sh` from `master`, pulls the images, runs `docker compose up -d --remove-orphans`, prunes old images and reapplies the firewall rule. `docker compose up -d` only restarts containers whose image or configuration changed. If GitHub is unreachable it keeps the files it has.

## Compose file

`deployment/docker-compose.yml` is the source. In short:

- `app`: port `${APP_PORT:-3020}`, volume `./data:/data`, runs as user 1000, memory limit 256 MB. The image carries its own health check on `/api/v1/health`.
- `hardware-agent`: `/dev/input` mounted read-only, device rule `c 13:* rmw`, the GPIO device `/dev/gpiochip0` for the buzzer, memory limit 64 MB, not privileged.

## Images

Built by `.github/workflows/build.yml` on a GitHub-hosted ARM runner, so no emulation:

- `ghcr.io/cerbrus/barcodescanner-app`: root `Dockerfile`. Builds API and frontend, then installs only the API's runtime packages. The version, commit hash and build time are baked in as `APP_VERSION`, `APP_COMMIT` and `APP_BUILT` and shown by the health endpoint and the System page.
- `ghcr.io/cerbrus/barcodescanner-agent`: `apps/hardware-agent/Dockerfile`.

A push that only changes documentation or the Dependabot set-up starts no build: nothing in the images would differ. A `checks` job runs first: lint for both apps, the API tests, the hardware agent's tests and `shellcheck` on the deployment scripts. Images are only built when it passes. Pushes to `master` publish `latest`, a version tag and a commit-hash tag. Pull requests only build.

### Version numbers

Every build of `master` gets a version `major.minor.patch`, for example `1.0.20`, worked out by `.github/scripts/version.sh`:

- `major.minor` comes from `version` in the root `package.json` and is raised by hand when a change deserves it.
- `patch` is the number of commits since `major.minor` last changed, so it rises with every push without anyone doing anything, and the same commit always gets the same number. The commit that raises `major.minor` is patch 0: `1.0.56`, then `1.1.0`, `1.1.1`, and so on.
- A new minor or major release is therefore one edit: change `version` in `package.json` to `1.1.0` or `2.0.0` and push. The third number in that file is not used.
- After the images are published, the workflow puts the git tag `v<version>` on the commit, so a version on the System page leads back to its code, and creates a GitHub release for it. The release text lists the commit subjects since the previous version; the Releases page of the repository is the change log.

Where to find the version of a build: on the System page, in the health endpoint, and in GitHub Actions. A run's title there is the commit message, which GitHub fixes before the version is known; the version is in the job names ("app image 1.0.15", "tag v1.0.15") and in the summary at the top of the run page. The tags page of the repository lists every version with its commit.

A local run without the build arguments reports version `dev`.

### Dependency updates

Dependabot (`.github/dependabot.yml`) opens pull requests every Monday. Packages that must move together come as one pull request per family, major versions included: Angular, Nx, NestJS, and the linting tools. Minor and patch updates of everything else come as one pull request; a major version of any other package comes on its own. Further one for the Docker base images and one for the GitHub Actions. A pull request runs the checks and builds both images without publishing. Nothing reaches the Pi until the pull request is merged into `master`.

**Reviewer.** Green checks do not say whether an update changes what the product does. `.github/workflows/dependabot-helper.yml` runs every morning. Its first job costs nothing: it lists the Dependabot pull requests that are at least 24 hours old, have finished their checks and were not reviewed yet for their current commit. For each of those it starts a Claude agent, which reads what changed between the versions, finds where this repository uses it, judges the effect on the product's behaviour, runs the checks, repairs what is small and clear, and leaves one comment with a verdict: safe to merge, merge with care, or do not merge. It never merges. Its rules are in `.github/dependabot-helper.md`.

Limits on what it can use: at most 3 pull requests per run, at most 3 reviews per pull request, 60 steps and 30 minutes per review, and the smaller Claude model. The numbers are at the top of the workflow file. To review right away, start the workflow by hand with the age set to 0 or with one pull request number. It uses the repository secret `CLAUDE_CODE_OAUTH_TOKEN`, a subscription token made with `claude setup-token` that is valid for a year, so runs count against the owner's Claude plan. The Claude GitHub App must be installed on the repository. GitHub pauses scheduled workflows of a public repository after 60 days without activity; the Actions page shows a button to switch them on again.

## Settings (`.env`)

| Variable | Meaning |
|---|---|
| `IMAGE_TAG` | `latest` by default. Set a version number such as `1.0.20` to pin that version. |
| `APP_PORT` | Host port of the web app and API, default `3020` |
| `ALLOWED_SOURCE` | Address of the reverse proxy; only it may reach `APP_PORT`. Several addresses: comma-separated. Empty means open to the whole network. |
| `SCANNER_DEVICE` | Path under `/dev/input/by-id/` of the scanner, ending in `-event-kbd` |
| `BACKUP_REPO` | SSH address of the private backup repository. Empty switches the backup off. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google OAuth client for login. An empty id switches login off. |
| `PUBLIC_URL` | Address the site is reached at, such as `https://shopping.example.com`, without a slash at the end |
| `ALLOWED_EMAILS` | Google accounts that may log in, comma-separated |
| `AGENT_TOKEN` | Secret the hardware agent uses instead of a login; `install.sh` creates it |
| `FEEDBACK_OUTPUT` | `none` (default) or `buzzer`: sound at the scanner, see "Buzzer" below |
| `BUZZER_PIN` | GPIO number of the buzzer pin, default `18` |
| `BUZZER_TYPE` | `active` (default) or `passive` |
| `BUZZER_ACTIVE_LOW` | `true` for modules that sound when the pin is low, default `false` |
| `PUSH_SUBJECT` | Contact address sent to the push services with every notification: `mailto:you@your-domain` or an `https` address. Set your own; some push services refuse placeholder addresses. |

Find the scanner path with `ls -l /dev/input/by-id/` after plugging in the dongle. Optional: `CONNECTORS` (default `ah,off`) picks the product lookup sources. 

## Reverse proxy (Nginx Proxy Manager)

Add a proxy host:

- **Domain name**: `shopping.<your domain>`.
- **Forward to**: scheme `http`, the wired LAN address of the server Pi, port `3020`. Nginx Proxy Manager runs as an add-on in Home Assistant on another machine, so give the server Pi a fixed address.
- **Firewall on the server Pi**: set `ALLOWED_SOURCE` in `.env` to the proxy's address. `deployment/firewall.sh` then drops every other source for the app's port; it runs at boot (`barcodescanner-firewall.service`) and after every update. Without this anything on the LAN can reach the port directly, around the proxy. Requests made on the Pi itself, such as `curl http://127.0.0.1:3020/api/v1/health`, keep working.
- **SSL**: request a certificate, force SSL.
- **Access List**: only needed while the app's own login is off (see "Login with Google"). With login on, attach none. Never expose port 3020 directly either way.
- **Advanced**, for the live event stream:

```nginx
location /api/v1/events {
    proxy_pass http://<pi-address>:3020;
    proxy_buffering off;
    proxy_read_timeout 1h;
}
```

## Reaching the site from inside the home network

When the site's public name points at the router, some routers pass requests from inside the network back in badly: small files load, large ones hang, and the page stays blank. Seen here on a laptop while a phone worked. The fix is a local DNS record on the home network's DNS server (Pi-hole: Settings, Local DNS Records) that points the site's name straight at the reverse proxy's LAN address. Devices at home then skip the router; from outside nothing changes. Give every name on the same proxy its own record.

## Updates, rollback, backup

- **Update**: push to `master`; the Pi follows within about 5 minutes plus build time.
- **Check**: the System page or `curl http://127.0.0.1:3020/api/v1/health` for the running version, `systemctl list-timers barcodescanner-update.timer`, `journalctl -u barcodescanner-update`, `docker compose ps`.
- **Rollback**: set `IMAGE_TAG=<version>` in `.env`, for example `1.0.20`, and run the updater. Images built before version numbers existed are only tagged with their commit hash. Database migrations only go forward, so restore the database backup when rolling back past a migration.
- **Backup**: see the next section. The log files are not backed up.
- **Logs**: the System page shows the live log; the same lines are in `/opt/barcodescanner/data/logs/app.log` (JSON lines, rotated at 256 KB, three old files kept).

## Database backup

The database is the only state that cannot be rebuilt: the links between barcodes and products, your own products, the list and the scan history. `deployment/backup.sh` writes it as SQL text and pushes it to a private git repository, so a dead SD card costs at most an hour of changes.

How it works:

- `barcodescanner-backup.timer` runs `backup.sh` every hour, and once after boot when a run was missed.
- The script first compares the database file's modification time with its last run and stops when nothing was written since. Otherwise it reads the database read-only with `sqlite3 .dump` while the app keeps running, writes `backup/app.sql`, and commits and pushes only when the content changed. A failed push is retried on the next run.
- The repository's history is the retention: every change is a commit, and `git log -p app.sql` shows what changed.
- It pushes with its own SSH key, `/opt/barcodescanner/backup_key`, which is a deploy key of the backup repository only. Nothing else on the Pi and no other repository can be reached with it.
- The backup repository must be private. This repository and the images stay free of data and keys.

One-time setup:

1. Create an empty private repository, for example `barcodescanner-backup`.
2. `install.sh` creates the key and prints the public half. Add it to the backup repository under Settings, Deploy keys, with write access. With the GitHub CLI: `gh repo deploy-key add backup_key.pub --repo <account>/barcodescanner-backup --allow-write --title "server pi"`.
3. Set `BACKUP_REPO=git@github.com:<account>/barcodescanner-backup.git` in `/opt/barcodescanner/.env`.
4. Run it once: `sudo systemctl start barcodescanner-backup.service`, then `journalctl -u barcodescanner-backup -n 20`.

The script writes its result to the app's system log: "backup: pushed" with the commit after a push, and an error line when the dump or the push fails. A run that finds nothing changed stays silent.

Check: the system log, `systemctl list-timers barcodescanner-backup.timer` and the commit list of the backup repository.

Restore, on a new or repaired Pi after `install.sh`:

```bash
cd /opt/barcodescanner
sudo docker compose stop app
git clone git@github.com:<account>/barcodescanner-backup.git /tmp/restore
sudo rm -f data/app.db data/app.db-wal data/app.db-shm
sudo sqlite3 data/app.db < /tmp/restore/app.sql
sudo chown 1000:1000 data/app.db
sudo docker compose up -d
```

The backup holds the database only. On a new card also fill in `.env` again: scanner device, proxy address, backup repository, the Google client id and secret, `PUBLIC_URL`, `ALLOWED_EMAILS`, the buzzer settings. The app makes new keys in `data/`, so everyone logs in once more and each device turns notifications off and on again.

Clone with your own GitHub login, or add the new Pi's `backup_key.pub` as deploy key first and remove the old one. For an older state, check out an earlier commit of the backup repository before loading `app.sql`. The dump includes the migration table, so a newer app version migrates it forward at start.

## Login with Google

The app has its own login. Set it up once:

1. In the Google Cloud console create a project and, under APIs and Services, an OAuth client of type "Web application". Authorised redirect address: `<PUBLIC_URL>/api/v1/auth/google/callback`. Authorised JavaScript origin: `<PUBLIC_URL>`.
2. On the consent screen (Google Auth Platform, Audience) set the user type to "External" and the publishing status to "Testing", and add the Google accounts that will log in as test users. With user type "Internal", which is offered when the project sits under an organisation, a normal Google account is refused with `Error 403: org_internal`. In testing mode the first login shows "Google hasn't verified this app"; continue past it.
3. Put the client id and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `PUBLIC_URL` and `ALLOWED_EMAILS`. Check that `AGENT_TOKEN` has a value.
4. Restart both containers: `sudo docker compose up -d --force-recreate`.
5. Open the site: it shows the login page. After logging in, remove the access list from the proxy host, otherwise there are two logins.

Check: `curl -i http://127.0.0.1:3020/api/v1/list` on the Pi answers `401`; the system log says "login is on for 1 Google account(s)"; a handheld scan still arrives, which proves the agent token works.

Notes:

- The client secret, the agent token and the session secret (`data/session-secret`) exist only on the Pi. `.env` is readable by root only.
- Logging everyone out: delete `data/session-secret` and restart the app.
- Locked out, for example after a typo in `ALLOWED_EMAILS`: fix `.env` over SSH and restart. Emptying `GOOGLE_CLIENT_ID` switches login off; put the proxy access list back first.
- The firewall rule stays: only the reverse proxy reaches the app's port.

## Buzzer

Optional sound at the scanner. Connect with the Pi switched off:

- Bare buzzer with two legs: long leg (+) to GPIO 18, which is physical pin 12; short leg to ground, physical pin 14 next to it. Peel off the sticker; it only protects the opening during soldering.
- Module with three pins: `VCC` to 3.3 V (physical pin 1), `GND` to physical pin 14, `I/O` to GPIO 18.
- GPIO 14 is taken by the fan. Any other free GPIO works; set `BUZZER_PIN` to its GPIO number, not the physical pin number.

Which kind: held between 3.3 V and ground, an active buzzer gives a steady tone and a passive one a single click.

Then set `FEEDBACK_OUTPUT=buzzer` and `BUZZER_TYPE` in `.env`, restart with `sudo docker compose up -d`, and play every signal once:

```bash
cd /opt/barcodescanner
sudo docker compose exec hardware-agent python3 agent.py --test-feedback
```

The System page has a button per sound as well, and the choice of sound per scan result. A module that beeps all the time except during a signal needs `BUZZER_ACTIVE_LOW=true`. The signals are listed in [architecture.md](architecture.md).

## Notifications

Nothing to install: the app creates its key pair in `/opt/barcodescanner/data/push-keys.json` on first use and each device subscribes from the System page. The Pi needs outgoing internet access only.

- Set `PUSH_SUBJECT` in `.env` and restart the app (`sudo docker compose up -d`).
- The proxy must serve `/sw.js` like any other file; no extra configuration.
- Check: the test button on the System page, and the system log, which records every send and the push service's answer when one fails.
- The key file is not in the backup. After a restore on a new card the app makes a new pair, and each device turns notifications off and on again once.

## Icon set

The icon files (`data/icons/`, English file names such as `milk.png`) and the seed file (`data/seed-items.json`) are committed. The image build copies both to `/app/data/`, so they update with every deploy and nothing is copied to the Pi by hand. The `icon` of each seed item is one of the file names without extension.
