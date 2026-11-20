# 0099. Every component keeps its template and styles in its own files

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner, issue #45

## Context

Templates and styles sat inside the component classes, which made the files long.

## Options weighed

Not recorded.

## Decision

Every component and page has its template and styles in files next to it (`name.component.html` and `.scss`, `name.page.html` and `.scss`), loaded with `templateUrl` and `styleUrl`. A component without styling has no style file.

## Consequences

The lint rule `@angular-eslint/component-max-inline-declarations` with `template: 0` and `styles: 0` keeps it that way, test components included.
