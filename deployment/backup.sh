#!/usr/bin/env bash
# Dumps the database as SQL text and pushes it to the private backup repository.
# Run by barcodescanner-backup.timer; safe to run by hand. Does nothing while BACKUP_REPO is empty.
set -euo pipefail

APP_DIR=/opt/barcodescanner
BACKUP_DIR=$APP_DIR/backup
KEY=$APP_DIR/backup_key
DATABASE=$APP_DIR/data/app.db

cd "$APP_DIR"

setting() {
    { grep -E "^$1=" .env || true; } | tail -1 | cut -d= -f2-
}

report() {
    local port
    port=$(setting APP_PORT)
    curl -fsS -m 5 -o /dev/null -X POST "http://127.0.0.1:${port:-3020}/api/v1/logs"         -H 'Content-Type: application/json' -H "X-Agent-Token: $(setting AGENT_TOKEN)"         -d "{\"level\":\"$1\",\"message\":\"backup: $2\"}" || true
}

trap 'report error "failed at line $LINENO of backup.sh, see journalctl -u barcodescanner-backup"' ERR

BACKUP_REPO=$(setting BACKUP_REPO)
if [ -z "$BACKUP_REPO" ]; then
    echo "BACKUP_REPO is not set in .env, nothing to do"
    exit 0
fi
if [ ! -f "$DATABASE" ]; then
    echo "no database at $DATABASE yet, nothing to do"
    exit 0
fi

export GIT_SSH_COMMAND="ssh -i $KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

if [ ! -d "$BACKUP_DIR/.git" ]; then
    git clone --quiet "$BACKUP_REPO" "$BACKUP_DIR"
fi

STAMP=$BACKUP_DIR/.git/last-dump
cd "$BACKUP_DIR"

if [ -f app.sql ] && [ -f "$STAMP" ] && [ ! "$DATABASE" -nt "$STAMP" ] && [ ! "$DATABASE-wal" -nt "$STAMP" ]; then
    echo "database untouched since the last backup"
else
    touch "$STAMP.new"
    sqlite3 -readonly -cmd '.timeout 10000' "$DATABASE" .dump > app.sql.new
    if ! tail -1 app.sql.new | grep -q '^COMMIT;$'; then
        rm -f app.sql.new "$STAMP.new"
        echo "dump is incomplete, keeping the previous backup" >&2
        report error "the dump was incomplete, the previous backup is kept"
        exit 1
    fi
    mv app.sql.new app.sql
    mv "$STAMP.new" "$STAMP"

    git add app.sql
    if git diff --cached --quiet; then
        echo "no changes since the last backup"
    else
        git -c user.name='barcodescanner backup' -c user.email='backup@barcodescanner.invalid' \
            commit --quiet -m "Backup $(date '+%Y-%m-%d %H:%M')"
        echo "committed $(git rev-parse --short HEAD)"
    fi
fi

if [ -n "$(git log --branches --not --remotes --oneline 2>/dev/null | head -1)" ]; then
    git push --quiet origin HEAD
    echo "pushed to $BACKUP_REPO"
    report info "pushed $(git rev-parse --short HEAD)"
fi
