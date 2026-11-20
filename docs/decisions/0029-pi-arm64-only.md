# 0029. Raspberry Pi 3 B+, images for linux/arm64 only

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (checked on the Pi)

## Context

Raspberry Pi 3 Model B+, 64-bit Debian 13, about 900 MB memory. Memory is tight and shared with two other services.

## Options weighed

Not recorded.

## Decision

Build `linux/arm64` only.

## Consequences

Nothing is built on the Pi and the image stays lean.
