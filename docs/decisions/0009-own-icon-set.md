# 0009. The user's own icon set, with emoji and letter tile as fallback

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

Tiles with a real icon read faster than text.

## Options weighed

Not recorded.

## Decision

The user's own icon set in `data/icons/`, one file per item. Fallback order: icon file, emoji, letter tile. Details:

- Items use the user's own customised icon set: 353 PNG files in `data/icons/`, with English file names (`milk.png`, `toilet_paper.png`).
- An item's `icon` in `data/seed-items.json` is one of those file names without extension. `null` means no icon.
- The app must work without the folder.
- Sections and items also carry an emoji. 350 of 358 items have one.
- The icons and `data/seed-items.json` are committed and ship inside the image. Only the database lives on the Pi's data volume.

## Consequences

The image carries the icons; the database alone lives on the data volume.
