# 0116. The last call waits only for pull requests that can board

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner

## Context

The train waited up to 5 minutes for every open pull request without the owner's approval ([0059](0059-release-train.md)). That counted pull requests that never get on: the owner's own, which he cannot approve, and the ones the train leaves out anyway. 7 of 11 trains between 2026-11-20 and 2026-11-24 waited the full 5 minutes for such a pull request. Each approval also starts its own train, so two approvals shortly after each other gave a second train that waited 5 minutes at an empty platform; 4 of those 11 runs were such trains.

## Options weighed

- Leave the wait as it is
- Count only the pull requests that can board, and do not wait when nobody holds a ticket

## Decision

The last call counts only a pull request that can board: not one written by the owner, from a fork, changing a workflow file or failing its own checks. The train leaves when none of those is left without approval, and does not wait at all when no pull request that can board is approved.

## Consequences

Refines the first point of [0059](0059-release-train.md); the 5 minutes stay the longest wait. A train that follows a landed one finds an empty platform within seconds.
