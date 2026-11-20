# 0089. Tailwind 4 with every colour a CSS variable

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/architecture.md`, `CLAUDE.md`.

## Options weighed

Not recorded.

## Decision

Styling uses Tailwind 4 with plain CSS; shared classes sit in `@layer components` so a utility on an element always wins. Every colour is a CSS variable in `styles.css`, which carries the light and dark theme; no hard-coded colours in components.

## Consequences

Builds on [0050](0050-appearance-follows-device.md).
