# 0117. The images the release train built are the ones that get published

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner

## Context

The train moves `master` forward to its own last commit, so the build that follows the push ran on the very commit the train had just checked: all checks and both images a second time ([0059](0059-release-train.md), fourth point). On the train of 2026-11-24 22:13 that second run took 4 minutes 40 seconds between landing and published images, and the images the train had built were thrown away.

## Options weighed

- Keep both runs
- Let the train publish `latest` itself (it would publish before `master` moved)
- The train pushes its images under their commit alone, and the build of `master` gives those the version and `latest`

## Decision

The train pushes both images under the tag of their commit and nothing else. The build that follows a push to `master` looks for both images of its commit: when they are there, it skips the checks and the build, gives those images the version tag and `latest`, and tags the release. When one is missing, such as after a push by the owner himself, it checks and builds as before.

- An image gets the tag of its commit only after the checks passed on that commit, on the train and on `master` alike. The build of `master` relies on that; keep it so.
- The Pi follows `latest`, so an image of a train that never landed is never installed. Such images stay in the registry.

## Consequences

Supersedes the fourth point of [0059](0059-release-train.md), that the checks run twice; its other points stand. `APP_COMMIT` in an image is the commit that was built, not the commit the workflow started from. A train that only changes what starts no build still pushes its two images, which nothing promotes.
