# 0023. A notification tap opens the inbox through hash addresses

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (settled on the iPhone, after three attempts)

## Context

A service worker handling the tap does not work on the iPhone: with the app in front, the phone never runs the handler.

## Options weighed

- A service worker handling the tap (does not work)
- The declarative message format, plain addresses (works, but the tap is a page load that restarted the app)
- The declarative message format with addresses after a `#` (`/#/inbox`)

## Decision

The declarative message format works: the phone opens the address in the message by itself. Addresses after a `#` (`/#/inbox`) make the phone treat the tap as a jump inside the open page.

## Consequences

This is why the app uses hash addresses, although plain ones look nicer. Do not switch back without retesting the tap.
