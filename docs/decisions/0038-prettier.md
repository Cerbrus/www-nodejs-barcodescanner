# 0038. Prettier formats the code and lint checks it

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner

## Context

One style without discussion.

## Options weighed

Not recorded.

## Decision

Prettier formats the code and `yarn lint:all` checks it. The choices: single quotes, 120 characters, 4 spaces, LF, no trailing commas, `bracketSameLine` off, and the Angular parser for HTML, so templates keep their control flow blocks readable.

## Consequences

The one commit that reformatted everything is named in `.git-blame-ignore-revs`.
