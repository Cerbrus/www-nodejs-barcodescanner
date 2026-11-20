# 0044. API hardening with the layered layout

- Status: accepted
- Date: 2026-11-13
- Decided by: the owner

## Context

Decided together with the layered layout of [0025](0025-api-layers.md).

## Options weighed

Not recorded.

## Decision

- A scan's source comes from who is calling, the agent's token or a browser session; it is not a field in the request. User types in the API may come some day; nothing is prepared for them.
- The agent's token opens four routes only.
- Each scan action is one transaction, and they run one at a time.
- Settings are read in one place.

## Consequences

Routes are closed by default, see [0082](0082-routes-closed-by-default.md).
