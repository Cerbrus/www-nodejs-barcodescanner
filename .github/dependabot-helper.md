# Notes for the Dependabot reviewer

Read by the shared reviewer of [Cerbrus/workflows](https://github.com/Cerbrus/workflows), which holds the instructions. This file only says what is specific to this repository.

## What the pull request's checks cover

The build workflow ran lint, tests and both arm64 image builds, without publishing. It could not cover publishing the images, the tag and release job, or anything else that only runs on `master`.

## Where updates can matter

- The Dockerfiles and the workflow files.
- `project.json` and `nx.json`.
- The ESLint and TypeScript configuration.

## Product behaviour to think of

- The scan rules.
- The database and its migrations.
- Login and the session cookie.
- Push notifications.
- The service worker and the offline snapshot.
- The camera decoder.
- The hardware agent.
- The deployment on a Raspberry Pi 3 (arm64, little memory).

## Install and checks

Install with `yarn install --immutable`; if the lock file is out of date, `yarn install`. Then run what the build runs:

- `yarn lint:all`
- `yarn product-api:test`
- `yarn product-api:test:integration`
- `yarn hardware-agent:test`
- `yarn product-api:build`
- `yarn product-front:build`

## Off limits

Do not touch `deployment/` or anything under `data/`.

## To try by hand

On the phone or the Pi.
