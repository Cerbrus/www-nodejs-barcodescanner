# 0095. Requests are validated with class-validator under /api/v1

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `apps/product-api/src/api/configure-api.ts`, `package.json`.

## Options weighed

Not recorded.

## Decision

The API is versioned under `/api/v1/...` and validates request types through a global `ValidationPipe` with `class-validator` and `class-transformer`. Settings are read through `AppConfig`; `process.env` is forbidden elsewhere.

## Consequences

Builds on [0044](0044-api-hardening.md).
