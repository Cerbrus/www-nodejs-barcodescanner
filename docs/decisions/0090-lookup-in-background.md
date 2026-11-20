# 0090. The product lookup runs in the background after the scan is answered

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/architecture.md` (Connectors).

## Options weighed

Not recorded.

## Decision

All enabled connectors run in parallel with a timeout of a few seconds after the scan has been answered. Results are stored on the barcode row, so a barcode is looked up once, and a `barcode` event tells open pages they arrived. `CONNECTORS` in `.env` picks the enabled ones (default `ah,off`).

## Consequences

A slow connector never delays the scanner. "No result" and "no answer" are different things; the second can be asked again.
