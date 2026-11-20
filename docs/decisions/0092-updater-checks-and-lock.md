# 0092. The updater does nothing when nothing changed, and shares a lock with the other updater

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/deployment.md`, `deployment/update.sh`.

## Options weighed

Not recorded.

## Decision

The updater runs every minute. It fetches its scripts and the compose file to memory and writes one to disk only when it changed (to spare the SD card), compares the registry's digest of each image, and asks Compose with a dry run what a restart would change; only then does it pull and restart. It takes the lock `/run/lock/docker-update.lock`, shared with the card scanner's updater, around pulling, restarting and pruning, and skips the round after waiting ten minutes.

## Consequences

Changed from every 5 minutes on 2026-11-16, as in the card scanner. Without the lock, Docker's image store broke the other's pull with "lease does not exist" (seen 2026-11-15). Builds on [0028](0028-pull-based-deployment.md).
