# 0036. Dependabot leaves major versions of npm packages out

- Status: accepted
- Date: 2026-11-16
- Decided by: the owner
- Supersedes: [0035](0035-dependabot-with-majors.md)

## Context

Under [0035](0035-dependabot-with-majors.md) majors came as a row of separate pull requests that break the build, and a major version of Angular or Nx needs its migration tooling, which Dependabot does not run.

## Options weighed

Not recorded.

## Decision

Major versions of npm packages are left out and done by hand; the Docker base images and the GitHub Actions still get them, and a security fix comes whatever its version.

## Consequences

Majors of Angular and Nx are a manual job.
