# 0045. One owner account gets the system parts, other accounts share the rest

- Status: accepted
- Date: 2026-11-13
- Decided by: the owner

## Context

Several accounts may be on the allowlist, see [0042](0042-login-with-google.md).

## Options weighed

Not recorded.

## Decision

One account is the owner and alone gets the system parts of the System page; other accounts on the allowlist keep language, appearance, notifications for their device and their account. The server enforces it. Everything else stays shared for now: list, products, inbox.

## Consequences

Whether other accounts later get their own list is undecided ([0043](0043-accounts-with-own-lists-dropped.md)).
