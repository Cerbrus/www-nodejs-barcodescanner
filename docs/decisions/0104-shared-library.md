# 0104. Code that the API and the web app both need lives in `libs/shared`

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

The recipe code ([0100](0100-recipes-as-qr-codes.md)) has to be written and read: the web app draws it and builds the tick sheet from a code the camera reads, the API reads a code from the handheld scanner. The API and the web app share no code; each has its own copy of the types they exchange. The API is bundled by webpack into one file and the web app by Angular's builder, so code they import is bundled with them.

## Options weighed

- **The API alone knows the format**: one implementation, but the web app has to ask the server what a scanned code holds, and reading a code needs a connection.
- **Both know the format, each with its own implementation**: two implementations that have to stay equal.
- **Both use one implementation from a shared library.**
- **The library's name**: `libs/recipe-code`, or a general `libs/shared` so that later shared code needs no new library.
- **What else moves there**: only the scan types that recipes change anyway, everything that is written twice today, or nothing.

## Decision

One library, `libs/shared`: plain TypeScript without Angular or NestJS, with its own tests, used by the API and the web app through a path alias.

It holds the reader and writer of the recipe code, and what is written twice today moves there before the recipe work starts:

- `ListState`, `ScanResult`, `ScanSource`
- `ProductSuggestion`
- the sound types and limits: `SoundBlock`, `BLOCK_KINDS`, `SoundStep`, `Sound`, the longest sound and the rate ranges
- the remark types: `REMARK_KINDS`, `RemarkTarget`, `RemarkContext`, `IssueStage`, `IssueProgress`, `IssueOptions`, `IssueDraft`

What stays where it is: the web app's shapes of API answers (the API's side of those are database classes), the naming, scan and remark rules that only the API runs, and the file-name pattern in the service worker, which is a plain script that cannot import.

## Consequences

- The first library in the repository ([0083](0083-yarn-nx-monorepo.md)): a path alias in `tsconfig.base.json`, its own lint and test targets, the API's import-layer rule allowing it, Prettier checking `libs`, and its tests among the build gates ([0084](0084-build-gates.md)).
- The hardware agent is Python and cannot use it; it only recognises a recipe code by its prefix ([0106](0106-agent-posts-barcodes-and-recipe-codes.md)).
- The order of the remark kinds differs between the two copies today; the web app's order is the order on screen and has to survive the move.
