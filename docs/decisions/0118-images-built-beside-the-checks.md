# 0118. The images are built beside the checks and get their tags after them

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner

## Context

The images waited for the checks ([0084](0084-build-gates.md)): 2 minutes 13 seconds of checks, then 3 minutes 59 seconds for the app image on the train of 2026-11-24 22:13. Neither needs the other's result to start.

## Options weighed

- Keep the images behind the checks
- Build beside the checks on the train only (GitHub fixes which job waits for which, so the image job would exist twice)
- Build beside the checks in every build

## Decision

In every build the images are built while the checks run. A build that publishes, the train or a push to `master`, pushes them as `unchecked-<commit>`. When the checks and both images are done, one job gives both images their real tags: the commit on the train, and the commit, the version and `latest` on `master`. A pull request builds and pushes nothing.

## Consequences

Changes the order in [0084](0084-build-gates.md): an image is made before the checks pass, but is not published before they pass, which keeps [0117](0117-train-images-are-published.md) true. Both images get their tags together, so one failed image no longer leaves the other published. A failed check wastes one image build and leaves `unchecked-` images in the registry; cleaning those up is in [the plan](../plan.md).
