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
| Docker | not installed |
| Other services | `recipes` and `webserver` (ports 3000 and 3010), `fan-control` |
| Port 3020 | free |
| Network | wired and wifi interface; point the proxy at the wired address |
| Scanner dongle | not plugged in at the time of the check |

Consequences:

- Build `linux/arm64` images only.
- The install script must install Docker Engine and the compose plugin.
- Memory is tight. Nothing is built on the Pi, and the app container gets a memory limit so it cannot starve the other services.

## On the Pi

```
/opt/barcodescanner/
├── docker-compose.yml    # fetched from the repo by the updater
├── .env                  # local settings, never overwritten
└── data/                 # SQLite database
```

One-time install, as one script (`deployment/install.sh`) that:

1. installs Docker Engine and the compose plugin if they are missing;
2. creates `/opt/barcodescanner/` and an `.env` from a template;
3. installs `barcodescanner-update.service` and `barcodescanner-update.timer`;
4. runs the updater once.

The updater does:

```bash
cd /opt/barcodescanner
curl -fsSL -o docker-compose.yml.new "https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment/docker-compose.yml" \
    && mv docker-compose.yml.new docker-compose.yml
docker compose pull --quiet
docker compose up -d --remove-orphans
docker image prune -f
```

`docker compose up -d` only restarts containers whose image or configuration changed.

## Compose file (shape)

```yaml
services:
    app:
        image: ghcr.io/cerbrus/barcodescanner-app:${IMAGE_TAG:-latest}
        restart: unless-stopped
        ports: ['3020:3020']
        volumes: ['./data:/data']
        env_file: .env
        healthcheck:
            test: ['CMD', 'wget', '-qO-', 'http://localhost:3020/api/v1/health']

    hardware-agent:
        image: ghcr.io/cerbrus/barcodescanner-agent:${IMAGE_TAG:-latest}
        restart: unless-stopped
        depends_on: [app]
        volumes: ['/dev/input:/dev/input:ro']
        device_cgroup_rules: ['c 13:* rmw']
        env_file: .env
```

## Settings (`.env`)

| Variable | Meaning |
|---|---|
| `IMAGE_TAG` | `latest` by default. Set a commit hash to pin a version. |
| `SCANNER_DEVICE` | Path under `/dev/input/by-id/` of the scanner, ending in `-event-kbd` |
| `FEEDBACK_OUTPUT` | `none` for now |
| `CONNECTORS` | Enabled connectors, for example `ah,off` |

Find the scanner path with `ls -l /dev/input/by-id/` after plugging in the dongle.

## Reverse proxy (Nginx Proxy Manager)

Add a proxy host:

- **Forward to**: the LAN address of the server Pi, port `3020`. Nginx Proxy Manager runs on a different Pi, so give the server Pi a fixed address.
- **Firewall on the server Pi**: allow port 3020 only from the proxy Pi's address. The app has no login, so anything else on the LAN that can reach 3020 bypasses the proxy's login.
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
- **Backup**: copy `/opt/barcodescanner/data/`. The app also copies `app.db` to `app.db.bak` before running a migration.

## Icon set

The icon files (`data/icons/`, English file names such as `milk.png`) and the seed file (`data/seed-items.json`) are committed. The image build copies both to `/app/data/`, so they update with every deploy and nothing is copied to the Pi by hand. The `icon` of each seed item is one of the file names without extension.
