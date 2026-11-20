# 0093. Rollback by setting IMAGE_TAG in .env

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/deployment.md`.

## Options weighed

Not recorded.

## Decision

Rolling back is setting `IMAGE_TAG=<version>` in the Pi's `.env`; the updater follows within a minute. The same goes for the way back to `latest`.

## Consequences

Tested 2026-11-15 (1.1.87 to 1.1.77 and back) and 2026-11-16 17:54 (1.1.106 to 1.1.102 and back). Migrations only go forward ([0078](0078-migrations-only.md)).
