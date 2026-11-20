# 0035. Dependabot: weekly pull requests, majors included

- Status: superseded by [0036](0036-dependabot-without-majors.md)
- Date: 2026-11-13
- Decided by: the owner

## Context

Dependencies must stay current without work.

## Options weighed

Not recorded.

## Decision

Dependency updates come as weekly pull requests from Dependabot: families that move together (Angular, Nx, NestJS, linting) as one pull request each; minor and patch versions of the rest grouped. Major versions were included.

## Consequences

Majors came as a row of separate pull requests that break the build. Changed by [0036](0036-dependabot-without-majors.md).
