# 0022. Web push for unknown handheld scans

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner

## Context

An unknown barcode scanned with the handheld needs the user's attention on the phone. No app store, no account.

## Options weighed

Not recorded.

## Decision

Web push for unknown barcodes scanned with the handheld scanner, with the inbox count as app badge: a service worker in the web app and the `web-push` package in the API.

## Consequences

The service worker did not cache anything at first; since the offline work of 2026-11-13 it keeps the app's files, never API answers (see [0014](0014-online-first.md)). A failed push never fails a scan, see [0080](0080-failures-never-fail-a-scan.md).
