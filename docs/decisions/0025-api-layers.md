# 0025. The API is layered: api, core, data, config

- Status: accepted
- Date: 2026-11-13
- Decided by: the owner

## Context

One thing per file, and a fixed place for each kind of thing. Plan: [archive/api-restructure-plan.md](../archive/api-restructure-plan.md).

## Options weighed

Not recorded.

## Decision

The API is layered: `api` (controllers, request types, guards), `core` (services, rules), `data` (entities, migrations), `config`.

## Consequences

Lint enforces that imports point inward only. See also [0079](0079-one-thing-per-file-and-table-owner.md).
