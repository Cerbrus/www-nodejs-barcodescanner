#!/usr/bin/env bash
# Limits the app's published port to the addresses in ALLOWED_SOURCE (the reverse proxy).
# Reads ALLOWED_SOURCE and APP_PORT from .env. An empty ALLOWED_SOURCE removes the limit.
# Run at boot by barcodescanner-firewall.service and after every update; safe to run by hand.
set -euo pipefail

APP_DIR=/opt/barcodescanner
CHAIN=BARCODESCANNER
STATE=/run/barcodescanner-firewall.state

setting() {
    grep -E "^$1=" "$APP_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2- || true
}

PORT=$(setting APP_PORT)
PORT=${PORT:-3020}
ALLOWED=$(setting ALLOWED_SOURCE)
JUMP=(-p tcp -m conntrack --ctorigdstport "$PORT" --ctdir ORIGINAL -j "$CHAIN")
WANTED="$PORT|$ALLOWED"

iptables -N DOCKER-USER 2>/dev/null || true

if [ -f "$STATE" ] && [ "$(cat "$STATE")" = "$WANTED" ]; then
    if [ -z "$ALLOWED" ] || iptables -C DOCKER-USER "${JUMP[@]}" 2>/dev/null; then
        exit 0
    fi
fi

iptables -S DOCKER-USER | { grep -- "-j $CHAIN\$" || true; } | sed 's/^-A/-D/' | while read -r rule; do
    # shellcheck disable=SC2086
    iptables $rule
done
iptables -F "$CHAIN" 2>/dev/null || true
iptables -X "$CHAIN" 2>/dev/null || true

if [ -n "$ALLOWED" ]; then
    iptables -N "$CHAIN"
    iptables -A "$CHAIN" -i lo -j RETURN
    iptables -A "$CHAIN" -i docker0 -j RETURN
    iptables -A "$CHAIN" -i br+ -j RETURN
    for source in ${ALLOWED//,/ }; do
        iptables -A "$CHAIN" -s "$source" -j RETURN
    done
    iptables -A "$CHAIN" -j DROP
    iptables -I DOCKER-USER "${JUMP[@]}"
    echo "port $PORT limited to: $ALLOWED"
else
    echo "port $PORT open to the whole network (ALLOWED_SOURCE is empty)"
fi

echo "$WANTED" > "$STATE"
