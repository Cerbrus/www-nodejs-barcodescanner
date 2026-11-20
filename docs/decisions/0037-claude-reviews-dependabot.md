# 0037. A Claude agent reviews every Dependabot pull request

- Status: accepted
- Date: 2026-11-13 (section date; the date of this item itself is not recorded)
- Decided by: the owner

## Context

The owner should only have to merge or not.

## Options weighed

Not recorded.

## Decision

A Claude agent reviews every Dependabot pull request once it is a day old: not only whether the checks pass, but whether the update changes or breaks what the product does. It repairs small things and leaves a verdict. It has no right to merge, a short list of tools, and treats changelogs as outside text.

## Consequences

It installs proposed package versions while holding a token that may write to the repository; the owner accepted that, see [0048](0048-only-admin-pushes-master.md).
