#!/usr/bin/env bash
# Add a new Node.js site to the Raspberry Pi.
# Usage: sudo bash add-site.sh <name> <port> [entry] [description]
#   name         — site name, used for the system user, directory, and service
#   port         — port the app listens on
#   entry        — Node.js entry point relative to app dir (default: dist/main.js)
#   description  — optional service description (default: "<name> website")
#
# Examples:
#   sudo bash add-site.sh product-api 3020
#   sudo bash add-site.sh product-front 4200 server/server.mjs "Product Frontend"
set -euo pipefail

if [ $# -lt 2 ]; then
    echo "Usage: sudo bash add-site.sh <name> <port> [entry] [description]"
    echo "  e.g. sudo bash add-site.sh product-api 3020"
    echo "       sudo bash add-site.sh product-front 4200 server/server.mjs \"Product Frontend\""
    exit 1
fi

APP_NAME="$1"
APP_PORT="$2"
APP_ENTRY="${3:-dist/main.js}"
APP_DESC="${4:-$APP_NAME website}"
APP_USER="$APP_NAME"
APP_DIR="/opt/$APP_NAME"

echo "==> Creating application user and directory for '$APP_NAME'"
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 775 "$APP_DIR"
usermod -aG "$APP_USER" deploy

echo "==> Creating systemd service: $APP_NAME.service"
cat > "/etc/systemd/system/$APP_NAME.service" <<EOF
[Unit]
Description=$APP_DESC
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node $APP_ENTRY
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME.service"

echo "==> Granting deploy user restart permission for $APP_NAME"
echo "deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart $APP_NAME" \
    > "/etc/sudoers.d/$APP_NAME"
chmod 440 "/etc/sudoers.d/$APP_NAME"

echo "==> Done. Deploy the app to $APP_DIR, then run:"
echo "    systemctl start $APP_NAME"
