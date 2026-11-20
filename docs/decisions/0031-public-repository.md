# 0031. The repository and the images are public

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner

## Context

A public repository needs no token or registry login on the Pi.

## Options weighed

Not recorded.

## Decision

The repository is public, and so are the images. Nothing secret goes into either: credentials live only in the `.env` file on the Pi.

## Consequences

No LAN addresses or personal addresses in the docs. No licence file, see [0039](0039-no-licence-file.md).
