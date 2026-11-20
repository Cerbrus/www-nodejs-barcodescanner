# 0078. Schema changes only through migrations, synchronize off

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md`, `apps/product-api/src/data/migrations/`.

## Options weighed

Not recorded.

## Decision

Every schema change is a new TypeORM migration; `synchronize` is off. Migrations only go forward.

## Consequences

Rolling back past a migration needs the database backup ([0030](0030-hourly-backup.md)), see [deployment.md](../deployment.md). A test runs the migrations (`migrations.integration.spec.ts`).
