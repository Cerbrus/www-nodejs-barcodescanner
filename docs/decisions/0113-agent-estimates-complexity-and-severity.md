# 0113. The agent estimates complexity and severity

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner (issue 75 asked for the estimate; the labels, the scales and the place of the estimate were proposed to him)

## Context

The agent answered an issue with a verdict, what was asked and what it did. Nothing said how large the change was or how much it mattered, so the owner had to open each issue and each pull request to see which needed his attention first and how carefully to review.

## Options weighed

- The estimate as a line in the agent's comment only: not visible in the list of issues, no filter
- The estimate as labels as well
- A separate word, impact, for wishes next to severity for bugs: two sets of labels
- One scale named severity, with its own meaning for a bug and for a wish
- The estimate made once, before the verdict
- The complexity corrected after the build, when the agent implemented it

## Decision

The agent estimates complexity (small, medium, large) and severity (low, medium, high) before its verdict, for every verdict, each with one sentence of reason. The criteria are fixed in `.github/issue-investigator.md`: complexity counts the parts, routes, migrations and design a change needs; severity is for a bug how much breaks or is lost, and for a wish or a note how much daily use gains.

The estimate is a line in the agent's comment, after what was asked, and in the body of its pull request. It is also two labels on the issue, `complexity: ...` and `severity: ...`, never on the pull request. When the agent implemented the issue, the complexity is what the change turned out to be, and the comment says so when that differs from the estimate. When nothing can be built there is no complexity label. A repair, a rebase and a revision leave the estimate alone; a new run through the label `investigate` estimates again.

## Consequences

The six labels are made once by the owner, since the agent may not create labels. The Feedback page does not show the estimate; it reads the labels of an issue already ([0068](0068-remark-progress-from-github.md)), so showing it there is a separate wish.
