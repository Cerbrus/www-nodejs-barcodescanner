# 0083. Yarn and Nx for the monorepo

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `package.json`, `nx.json`, `yarn.lock`.

## Options weighed

Not recorded.

## Decision

One repository with `apps/product-api`, `apps/product-front` and `apps/hardware-agent`; Yarn is the package manager and Nx runs the API and web app builds, lints and web tests. The API tests, the e2e tests and the agent tests are plain scripts in `package.json`.

## Consequences

Nx project names are `product-api` and `product-front`.
