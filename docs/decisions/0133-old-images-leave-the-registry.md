# 0133. Images that nothing uses leave the registry every week

- Status: accepted
- Date: 2026-11-28
- Decided by: the owner

## Context

Every build that publishes leaves images in the registry ([0118](0118-images-built-beside-the-checks.md)), and nothing ever removed one. On 2026-11-28 the app package held 300 versions and the agent package 167. About half had no tag at all, and the rest were `unchecked-<commit>` images and every version since the first.

The registry removes by content, not by tag. One version of the agent carried every tag from 1.2.60 to 1.2.103 and `latest`, because the agent had not changed. A version, a commit and `latest` are a small index that points at the image pushed as `unchecked-<commit>`, and an image an index points at may have no tag of its own. So a rule that reads tags alone removes images that are in use.

## Options weighed

- **A script of our own**, started by a workflow: by hand as a trial that removes nothing, and every week for real.
- **A ready-made action**: less to write, but someone else's code with a token that may remove packages, and no rule for images that are only hours old.
- **Removing at the source**: the build removes its `unchecked-` image when the checks fail, and the train removes the images of a train that did not land. It races with a second run of the same commit and leaves what is already there.
- **How many versions stay** for a rollback.

## Decision

**A script, `.github/scripts/registry-cleanup.sh`, removes what nothing uses**, for the app and the agent package. `.github/workflows/registry-cleanup.yml` starts it every Monday at 04:17 UTC, and by hand, where it only lists what would go unless the trial is switched off.

**What stays**: `latest`, the ten newest versions, any other tag named at a start by hand, and everything changed in the last 24 hours, which covers a build or a train that is running. The script reads each of those from the registry and also keeps every image it points at. Everything else goes, with or without a tag.

**It removes nothing when it is not sure**: a package without `latest` is left alone, and a kept image that cannot be read stops the run before the first removal.

## Consequences

- A rollback reaches back ten versions ([deployment](../deployment.md)). An older version pinned with `IMAGE_TAG` on the Pi must be named as a tag to keep, or it is gone at the next run.
- `unchecked-` images of failed builds and the images of trains that never landed go once they are a day old.
- The card scanner's packages and the others of the account are not touched.
- The script needs the packages to be public: it reads them from the registry without a login.
