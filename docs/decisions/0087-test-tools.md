# 0087. Vitest for the web app, Playwright with the installed Chrome for end to end

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md`, `package.json`.

## Options weighed

Not recorded.

## Decision

Web app tests run in Vitest with `happy-dom`, without a browser, next to the file as `*.spec.ts`, with shared fakes in `src/testing/fakes.ts`. API tests use the Node test runner, the integration tests on a temporary SQLite file. The end-to-end tests use Playwright with the installed Chrome, start the built app themselves and make their own camera picture. The agent tests use Python's `unittest` with a fake scanner, buzzer and API.

## Consequences

No test needs a browser download or the Pi.
