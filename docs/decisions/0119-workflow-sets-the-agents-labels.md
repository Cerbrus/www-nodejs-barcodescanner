# 0119. The workflow sets the agent's labels, read from its comment

- Status: accepted
- Date: 2026-11-25
- Decided by: the owner (he disliked the extra runs; the way to end them was proposed to him)

## Context

The agent labelled the issue itself: its verdict, and since [0113](0113-agent-estimates-complexity-and-severity.md) the two estimate labels. Its `gh` works with the token of the Claude app, and a label set with that token is an event that starts the investigator's workflow. GitHub cannot filter that start by the name of the label, so each label made a run that was skipped or cancelled: one per issue before the estimate, three since.

## Options weighed

- Leave it: the runs do nothing, but they fill the list of runs
- The agent writes its verdict to a file that the workflow reads: one more thing for the agent to do, and a write into `.git`
- The workflow reads the verdict and the ratings from the agent's comment, which has a fixed form already
- The agent no longer labels, and the estimate stays in the comment only: loses the labels of 0113

## Decision

The agent sets no label and assigns nobody. After its run, `.github/scripts/issue-verdict.sh` reads the line under "Verdict" and the two ratings under "Estimate" from the agent's comment, and with the workflow's own token labels the issue, removes `investigate` and the labels of an earlier run, and assigns the issue or the pull request to the owner. A label set with that token starts no workflow.

The script takes only a comment that the agent's account wrote after this run began, so a comment by anyone else, or one left by an earlier run, sets nothing. A comment without a known verdict fails the run, and the issue is handed to the owner as for any failed run.

This replaces who sets the labels in 0113 and in [0114](0114-agent-verifies-a-bug-report.md); what the labels are and mean stays.

## Consequences

The verdict and the ratings must be written in the fixed form of the comment, or the run fails. The agent cannot misspell a label any more. One run that does nothing remains per issue from the app: it sends `bug` or `enhancement` along with `investigate`, as two labels.
