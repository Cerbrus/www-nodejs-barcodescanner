#!/usr/bin/env bash
# One-time setup of the barcode scanner on a Raspberry Pi (64-bit Debian or Raspberry Pi OS).
# Usage: sudo bash install.sh
# Safe to run again: existing settings and data are kept.
set -euo pipefail

APP_DIR=/opt/barcodescanner
REPO_RAW=https://raw.githubusercontent.com/Cerbrus/www-nodejs-barcodescanner/master/deployment
DATA_OWNER=1000:1000
CMDLINE=/boot/firmware/cmdline.txt

if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo." >&2
    exit 1
fi

echo "==> Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ca-certificates curl
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
        > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
    echo "    already installed"
fi

echo "==> Backup tools"
if ! command -v git >/dev/null || ! command -v sqlite3 >/dev/null; then
    apt-get update
    apt-get install -y git sqlite3
else
    echo "    already installed"
fi

echo "==> Memory limits"
REBOOT_NEEDED=0
if [ -f "$CMDLINE" ] && ! grep -q "cgroup_enable=memory" "$CMDLINE"; then
    cp -n "$CMDLINE" "$CMDLINE.bak-barcodescanner"
    sed -i '1 s/$/ cgroup_enable=memory cgroup_memory=1/' "$CMDLINE"
    REBOOT_NEEDED=1
    echo "    kernel parameters added"
else
    echo "    already enabled"
fi

echo "==> $APP_DIR"
mkdir -p "$APP_DIR/data"
chown -R "$DATA_OWNER" "$APP_DIR/data"
for script in update.sh firewall.sh backup.sh; do
    curl -fsSL -o "$APP_DIR/$script" "$REPO_RAW/$script"
    chmod +x "$APP_DIR/$script"
done
if [ ! -f "$APP_DIR/.env" ]; then
    curl -fsSL -o "$APP_DIR/.env" "$REPO_RAW/env.template"
    SCANNER=$(find /dev/input/by-id -name '*-event-kbd' 2>/dev/null | head -1 || true)
    if [ -n "$SCANNER" ]; then
        sed -i "s#^SCANNER_DEVICE=.*#SCANNER_DEVICE=$SCANNER#" "$APP_DIR/.env"
        echo "    scanner found: $SCANNER"
    else
        echo "    no scanner found: set SCANNER_DEVICE in $APP_DIR/.env"
    fi
else
    echo "    keeping existing .env"
fi

echo "==> Backup key"
if [ ! -f "$APP_DIR/backup_key" ]; then
    ssh-keygen -q -t ed25519 -N '' -C "barcodescanner backup on $(hostname)" -f "$APP_DIR/backup_key"
    echo "    created; add this as a deploy key with write access to the private backup repository:"
    echo "    $(cat "$APP_DIR/backup_key.pub")"
else
    echo "    keeping existing key"
fi

echo "==> Update timer"
cat > /etc/systemd/system/barcodescanner-update.service <<EOF
[Unit]
Description=Update the barcode scanner containers
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$APP_DIR/update.sh
EOF

cat > /etc/systemd/system/barcodescanner-update.timer <<EOF
[Unit]
Description=Check for barcode scanner updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=30

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/barcodescanner-firewall.service <<EOF
[Unit]
Description=Limit the barcode scanner port to the reverse proxy
After=docker.service
Wants=docker.service

[Service]
Type=oneshot
ExecStart=$APP_DIR/firewall.sh

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/barcodescanner-backup.service <<EOF
[Unit]
Description=Back up the barcode scanner database
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$APP_DIR/backup.sh
EOF

cat > /etc/systemd/system/barcodescanner-backup.timer <<EOF
[Unit]
Description=Back up the barcode scanner database every hour

[Timer]
OnCalendar=hourly
RandomizedDelaySec=5min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now barcodescanner-backup.timer
systemctl enable --now barcodescanner-update.timer
systemctl enable barcodescanner-firewall.service
systemctl start barcodescanner-firewall.service || echo "    firewall rule failed: journalctl -u barcodescanner-firewall"

echo "==> First update"
systemctl start barcodescanner-update.service || echo "    first update failed: journalctl -u barcodescanner-update"

echo "==> Done"
if [ "$REBOOT_NEEDED" -eq 1 ]; then
    echo "Reboot once to activate container memory limits."
fi
