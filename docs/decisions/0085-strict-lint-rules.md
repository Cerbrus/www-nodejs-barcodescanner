# 0085. Strict lint rules

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `eslint.config.mjs`, `CLAUDE.md`.

## Options weighed

Not recorded.

## Decision

Strict TypeScript: no `any`, explicit member accessibility and return types, ordered imports, blank lines between multi-line class members, member ordering, at most 75 lines per function, generic array types. No ignore comments or weakened rules to make a check pass.

## Consequences

The layer rule of [0025](0025-api-layers.md) is enforced by lint.
