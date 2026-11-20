# 0027. SQLite on a Docker volume

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

No database container; backup is one file.

## Options weighed

- PostgreSQL (removed, see [0026](0026-removed-overhead.md))
- SQLite file

## Decision

SQLite file on a Docker volume, at `/data/app.db`.

## Consequences

Backup is [0030](0030-hourly-backup.md). Schema changes need a migration, see [0078](0078-migrations-only.md).
