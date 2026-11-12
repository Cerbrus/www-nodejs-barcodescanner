#!/usr/bin/env bash
# Prints the version of the checked-out commit: major.minor from package.json, and as patch
# the number of commits since major.minor last changed. Needs the full git history.
set -euo pipefail

base_at() {
    git show "$1:package.json" 2>/dev/null \
        | node -p "JSON.parse(require('fs').readFileSync(0, 'utf8')).version.split('.').slice(0, 2).join('.')" 2>/dev/null \
        || true
}

BASE=$(base_at HEAD)
BUMP=
for commit in $(git log --format=%H -- package.json); do
    if [ "$(base_at "$commit^")" != "$BASE" ]; then
        BUMP=$commit
        break
    fi
done

if [ -n "$BUMP" ]; then
    PATCH=$(git rev-list --count "$BUMP..HEAD")
else
    PATCH=$(git rev-list --count HEAD)
fi

echo "$BASE.$PATCH"
