# 0082. Routes are for logged-in users by default

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md` in short.

## Options weighed

Not recorded.

## Decision

One global guard protects every route. A route is open only when marked `@Public()`, opens for the hardware agent only with `@Agent()`, and belongs to the owner account only with `@OwnerOnly()`.

## Consequences

A new route cannot be left open by forgetting a guard. Builds on [0042](0042-login-with-google.md), [0044](0044-api-hardening.md) and [0045](0045-owner-and-other-accounts.md).
