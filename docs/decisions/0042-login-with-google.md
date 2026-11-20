# 0042. Login with Google inside the app, for an allowlist

- Status: accepted
- Date: 2026-11-13
- Decided by: the owner
- Supersedes: [0041](0041-access-by-proxy-list.md)

## Context

The proxy's access list of [0041](0041-access-by-proxy-list.md) did not guard the site and basic auth is clumsy in a home-screen app.

## Options weighed

- The proxy's access list (dropped)
- Login with Google in the app

## Decision

Login with Google inside the app, for the owner only, for the accounts on an allowlist. The allowlist can hold more addresses later; they would share the one list. No user table: the session is a signed cookie, and the hardware agent uses a shared secret.

## Consequences

Accounts with their own lists were dropped, see [0043](0043-accounts-with-own-lists-dropped.md). Which accounts get what: [0045](0045-owner-and-other-accounts.md).
