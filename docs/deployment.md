# Deployment

Target design. The scripts in `deployment/` and the current GitHub workflow are the old push-based setup and are replaced in milestone 2 of [plan.md](plan.md).

## Principle

The Pi pulls; nothing pushes to the Pi.

1. A push to `master` makes GitHub Actions build the `app` and `hardware-agent` images and publish them to GitHub's container registry (`ghcr.io`), tagged `latest` and with the commit hash.
2. A systemd timer on the Pi runs every 5 minutes: fetch the compose file, pull images, restart what changed.
3. The Pi needs Docker and outbound internet. No inbound port for deployment, no SSH key in GitHub, no Node or Python on the Pi.

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
|-- update.sh             # the updater; refreshes itself from the repo
|-- .env                  # local settings, never overwritten
`-- data/                 # SQLite database, owned by user 1000
```

One-time install on a fresh Pi:

```bash
curl -fsSLO https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment/install.sh
sudo bash install.sh
```

`deployment/install.sh` can be run again safely. It:

1. installs Docker Engine and the compose plugin if they are missing;
2. adds the kernel parameters for container memory limits if they are missing (needs one reboot);
3. creates `/opt/barcodescanner/` with `data/`, `update.sh` and an `.env` from `deployment/env.template`, filling in the scanner device when one is plugged in;
4. installs and starts `barcodescanner-update.timer` (2 minutes after boot, then every 5 minutes);
5. runs the updater once.

The updater, `deployment/update.sh`, fetches the current `docker-compose.yml` and its own newer version from `master`, pulls the images, runs `docker compose up -d --remove-orphans` and prunes old images. `docker compose up -d` only restarts containers whose image or configuration changed. If GitHub is unreachable it keeps the files it has.

## Compose file

`deployment/docker-compose.yml` is the source. In short:

- `app`: port `${APP_PORT:-3020}`, volume `./data:/data`, runs as user 1000, memory limit 256 MB. The image carries its own health check on `/api/v1/health`.
- `hardware-agent`: `/dev/input` mounted read-only, device rule `c 13:* rmw`, memory limit 64 MB, not privileged.

## Images

Built by `.github/workflows/build.yml` on a GitHub-hosted ARM runner, so no emulation:

- `ghcr.io/cerbrus/barcodescanner-app`: root `Dockerfile`. Builds API and frontend, then installs only the API's runtime packages. The commit hash is baked in as `APP_VERSION` and shown by the health endpoint.
- `ghcr.io/cerbrus/barcodescanner-agent`: `apps/hardware-agent/Dockerfile`.

A `checks` job runs first: lint for both apps and the API tests. Images are only built when it passes. Pushes to `master` publish `latest` and a commit-hash tag. Pull requests only build.

## Settings (`.env`)

| Variable | Meaning |
|---|---|
| `IMAGE_TAG` | `latest` by default. Set a commit hash to pin a version. |
| `APP_PORT` | Host port of the web app and API, default `3020` |
| `ALLOWED_SOURCE` | Address of the reverse proxy; only it may reach `APP_PORT`. Several addresses: comma-separated. Empty means open to the whole network. |
| `SCANNER_DEVICE` | Path under `/dev/input/by-id/` of the scanner, ending in `-event-kbd` |

Find the scanner path with `ls -l /dev/input/by-id/` after plugging in the dongle. Optional: `CONNECTORS` (default `ah,off`) picks the product lookup sources. A later milestone adds a setting for feedback output.

## Reverse proxy (Nginx Proxy Manager)

Add a proxy host:

- **Domain name**: `shopping.<your domain>`.
- **Forward to**: scheme `http`, the wired LAN address of the server Pi, port `3020`. Nginx Proxy Manager runs as an add-on in Home Assistant on another machine, so give the server Pi a fixed address.
- **Firewall on the server Pi**: set `ALLOWED_SOURCE` in `.env` to the proxy's address. `deployment/firewall.sh` then drops every other source for the app's port; it runs at boot (`barcodescanner-firewall.service`) and after every update. The app has no login, so without this anything on the LAN that can reach the port bypasses the proxy's login. Requests made on the Pi itself, such as `curl http://127.0.0.1:3020/api/v1/health`, keep working.
- **SSL**: request a certificate, force SSL.
- **Access List**: attach one for the login. The app itself has no authentication, so never expose port 3020 directly.
- **Advanced**, for the live event stream:

```nginx
location /api/v1/events {
    proxy_pass http://<pi-address>:3020;
    proxy_buffering off;
    proxy_read_timeout 1h;
}
```

## Updates, rollback, backup

- **Update**: push to `master`; the Pi follows within about 5 minutes plus build time.
- **Check**: `systemctl list-timers barcodescanner-update.timer`, `journalctl -u barcodescanner-update`, `docker compose ps`.
- **Rollback**: set `IMAGE_TAG=<commit hash>` in `.env` and run the updater. Database migrations only go forward, so restore the database backup when rolling back past a migration.
- **Backup**: copy `/opt/barcodescanner/data/`. It holds the database and `logs/app.log` with its rotated files.
- **Logs**: the System page shows the live log; the same lines are in `/opt/barcodescanner/data/logs/app.log` (JSON lines, rotated at 1 MB, five old files kept).

## Icon set

The icon files (`data/icons/`, English file names such as `milk.png`) and the seed file (`data/seed-items.json`) are committed. The image build copies both to `/app/data/`, so they update with every deploy and nothing is copied to the Pi by hand. The `icon` of each seed item is one of the file names without extension.
