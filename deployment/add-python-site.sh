#!/usr/bin/env bash
# Add a new Python service to the Raspberry Pi.
# Creates a system user, directory, virtual environment, and systemd service.
# Usage: sudo bash add-python-site.sh <name> <port> <script> [description]
#   name         — service name, used for the system user, directory, and service
#   port         — port the app listens on (use 0 for services without a port)
#   script       — Python script to run (e.g. server.py)
#   description  — optional service description (default: "<name> service")
#
# Examples:
#   sudo bash add-python-site.sh supermarkt-connector 5000 server.py
#   sudo bash add-python-site.sh input-listener 0 listener.py "Barcode input listener"
#
# Note: services that need raw device access (e.g. input-listener using the
#       keyboard library) must run as root. Edit the generated .service file
#       and change User= to root after running this script.
set -euo pipefail

if [ $# -lt 3 ]; then
    echo "Usage: sudo bash add-python-site.sh <name> <port> <script> [description]"
    echo "  e.g. sudo bash add-python-site.sh supermarkt-connector 5000 server.py"
    echo "       sudo bash add-python-site.sh input-listener 0 listener.py"
    exit 1
fi

APP_NAME="$1"
APP_PORT="$2"
APP_SCRIPT="$3"
APP_DESC="${4:-$APP_NAME service}"
APP_USER="$APP_NAME"
APP_DIR="/opt/$APP_NAME"
VENV_DIR="$APP_DIR/.venv"

echo "==> Creating application user and directory for '$APP_NAME'"
if ! id "$APP_USER" &>/dev/null; then
    useradd --system --shell /usr/sbin/nologin --home-dir "$APP_DIR" "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown "$APP_USER":"$APP_USER" "$APP_DIR"
chmod 775 "$APP_DIR"
usermod -aG "$APP_USER" deploy

echo "==> Creating Python virtual environment"
python3 -m venv "$VENV_DIR"
chown -R "$APP_USER":"$APP_USER" "$VENV_DIR"

if [ -f "$APP_DIR/requirements.txt" ]; then
    echo "==> Installing dependencies from requirements.txt"
    sudo -u "$APP_USER" "$VENV_DIR/bin/pip" install -r "$APP_DIR/requirements.txt"
else
    echo "==> No requirements.txt found in $APP_DIR (will install after first deploy)"
fi

echo "==> Creating systemd service: $APP_NAME.service"
cat > "/etc/systemd/system/$APP_NAME.service" <<EOF
[Unit]
Description=$APP_DESC
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
ExecStart=$VENV_DIR/bin/python $APP_SCRIPT
Restart=on-failure
RestartSec=5
Environment=PORT=$APP_PORT

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$APP_NAME.service"

echo "==> Granting deploy user permissions for $APP_NAME"
cat > "/etc/sudoers.d/$APP_NAME" <<EOF
deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart $APP_NAME
deploy ALL=($APP_USER) NOPASSWD: $VENV_DIR/bin/pip install *
EOF
chmod 440 "/etc/sudoers.d/$APP_NAME"

echo "==> Done. Deploy the app to $APP_DIR, then run:"
echo "    systemctl start $APP_NAME"
