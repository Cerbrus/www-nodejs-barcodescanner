# 0079. One thing per file, one owning service per table, transactions through TransactionRunner

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md` code style.

## Options weighed

Not recorded.

## Decision

One controller, request type, entity or service per file; module files only wire things together. A table has one owning service; other services ask it. Work that writes several tables runs through `TransactionRunner`, and events go out after it.

## Consequences

Builds on [0025](0025-api-layers.md) and [0044](0044-api-hardening.md).
