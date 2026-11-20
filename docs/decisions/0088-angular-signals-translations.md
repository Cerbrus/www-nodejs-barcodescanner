# 0088. Angular with standalone components, signals, Dutch and English texts

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `docs/architecture.md`, `CLAUDE.md`.

## Options weighed

Not recorded.

## Decision

Standalone components, signals over observables in components, no state library (`shopping.store` holds the state), prefix `app`. Texts through `@ngx-translate`, Dutch by default and English, every visible text in both language files.

## Consequences

The message format is FormatJS ([0046](0046-content-security-policy.md)).
