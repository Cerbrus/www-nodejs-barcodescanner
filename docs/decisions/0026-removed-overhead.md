# 0026. Removed: CQRS, mappers, repository layers, Slack leftovers, Python connector, PostgreSQL

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review, confirmed 2026-11-13 when the API got its layers)

## Context

Overhead for a home tool with a handful of tables.

## Options weighed

Not recorded.

## Decision

Removed: CQRS, mapper and repository layers, Slack-poll leftovers, the Python supermarket connector, PostgreSQL. Confirmed 2026-11-13: no class per use case, no separate domain models, no mappers.

## Consequences

A controller calls a service, a service uses TypeORM directly.
