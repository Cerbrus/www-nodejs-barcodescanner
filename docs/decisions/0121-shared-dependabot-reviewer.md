# 0121. The Dependabot reviewer is a shared workflow

- Status: accepted
- Date: 2026-11-26
- Decided by: the owner (he chose the shared version over a copy per repository)

## Context

The reviewer of [0037](0037-claude-reviews-dependabot.md) was written here and copied to the card scanner, where the copy had already drifted: an older form of the comment, another Node version. The owner wanted the same reviewer for the web server behind `error.cerbrus.nl` and did not want a third copy.

## Options weighed

- **A copy per repository.** Quick, and every repository can be read on its own. Every change has to be made in each of them.
- **A reusable workflow in one repository.** The logic and the instructions for the agent exist once; each repository keeps a short workflow that calls it and a file with what is specific to that repository.

## Decision

A reusable workflow in the public repository [Cerbrus/workflows](https://github.com/Cerbrus/workflows). It holds both jobs (finding the pull requests that are due, and the review) and the instructions for the agent, in the prompt of the review job.

This repository keeps `.github/workflows/dependabot-helper.yml`, which sets the schedule and calls the shared workflow at `master`, and `.github/dependabot-helper.md`, which now holds only what is specific to this product: what the pull request's checks cover, where updates can matter, the parts of the product to think of, the install command and the checks, and what is off limits.

What the reviewer does, its limits and the form of its comment stay as in 0037.

## Consequences

A change to the shared workflow reaches this repository at its next run, without a pull request here. Whoever can push to `master` of `Cerbrus/workflows` decides what an agent with a token that may write to this repository is told; only the admin role can push there, as here ([0048](0048-only-admin-pushes-master.md)). The numbers that limit a run (3 pull requests per run, 3 reviews per pull request, 60 steps, 30 minutes, the model) are in the shared workflow; the first two and the model are inputs a caller can set.
