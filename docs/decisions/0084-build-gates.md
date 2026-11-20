# 0084. The build runs lint, all tests and the end-to-end test first

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md`, `package.json`, `.github/workflows/build.yml`.

## Options weighed

Not recorded.

## Decision

The build runs lint (with the format check), the API unit and integration tests, the web tests, the agent tests and `yarn e2e` before an image is made, so those stay green. A web app change comes with its test.

## Consequences

The release train runs the same checks, see [0059](0059-release-train.md).
