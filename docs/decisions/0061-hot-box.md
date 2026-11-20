# 0061. A pull request whose own checks fail is left behind (hot box)

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner

## Context

A failing pull request would stop the whole train, also when it is approved.

## Options weighed

Not recorded.

## Decision

A pull request whose own checks fail is left behind too ("hot box"), also when it is approved.

## Consequences

It rides again once its checks pass.
