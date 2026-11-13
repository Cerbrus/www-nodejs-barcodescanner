setting() {
    { grep -E "^$1=" .env || true; } | tail -1 | cut -d= -f2-
}

report() {
    local port
    port=$(setting APP_PORT)
    curl -fsS -m 5 -o /dev/null -X POST "http://127.0.0.1:${port:-3020}/api/v1/logs"         -H 'Content-Type: application/json' -H "X-Agent-Token: $(setting AGENT_TOKEN)"         -d "{\"level\":\"$1\",\"message\":\"backup: $2\"}" || true
}

trap 'report error "failed at line $LINENO of backup.sh, see journalctl -u barcodescanner-backup"' ERR
