# 0094. Open pages follow the server through a server-sent event stream

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/architecture.md`, `apps/product-api/src/api/controllers/event.controller.ts`.

## Options weighed

Not recorded.

## Decision

`GET /api/v1/events` streams server-sent events (`scan`, `list`, `barcode`, `catalog`, `log`, `feedback` and a `ping` every 25 seconds). The page reloads its data on an event; when the stream ends it opens a new one every 3 seconds, and it reconnects when the network returns or the page comes back to the foreground.

## Consequences

Every open page follows scans made elsewhere; the "no connection" banner covers the gaps.
