# 0030. Hourly SQL dump pushed to a private repository

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner

## Context

The data must survive the SD card.

## Options weighed

- A cloud drive (extra tool and login)
- Continuous replication (too heavy for a shopping list)
- An hourly SQL dump pushed to a private git repository

## Decision

The Pi pushes an hourly SQL dump of the database to a private git repository, using a deploy key that only reaches that repository.

## Consequences

Details in [deployment.md](../deployment.md). The backup repository is private and separate; nothing from it belongs in this repository.
