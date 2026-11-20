# 0046. Content security policy, first in report-only mode

- Status: accepted
- Date: 2026-11-13
- Decided by: the owner

## Context

A strict policy would stop injected scripts. The former message format library (`@messageformat/core`) needs `eval` by design.

## Options weighed

- Angular's built-in translation (builds one app per language and cannot switch language while running; dropped)
- FormatJS `intl-messageformat`, the replacement its own maintainers name

## Decision

The policy starts in report-only mode and reports go to the existing system log, not to a file or table of their own. After a week of use without reports the owner sets `CSP_MODE=enforce` on the Pi; no release is needed for that step, and `report` is the way back. The policy does not allow `eval`, so `@messageformat/core` was replaced by FormatJS `intl-messageformat`; the translation files did not change.

## Consequences

See [archive/product-review-2026-11-13.md](../archive/product-review-2026-11-13.md) for the question that led to it.
