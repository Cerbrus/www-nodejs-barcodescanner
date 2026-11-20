# 0055. A changelog in the app, written from the git history

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner (his issue #23)

## Context

The owner wanted to see what changed.

## Options weighed

- An API route and a table (nothing to store; dropped)
- A file in the web app

## Decision

The app shows a changelog to every logged-in account, a summary line per version with date and time, expanding into its notes. The data is a file in the web app, written from the git history by `tools/changelog.mjs`, notes in English.

## Consequences

Changed in review the same day: the build writes the file just before the image is made, including the version being built, instead of a committed file that was refreshed by hand and so always lacked the newest version.
