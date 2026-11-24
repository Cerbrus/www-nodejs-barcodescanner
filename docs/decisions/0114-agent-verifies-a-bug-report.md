# 0114. The agent verifies a bug report and rejects one it proved false

- Status: accepted
- Date: 2026-11-24
- Decided by: the owner (he asked for the verification and the rejection; the verdict, the proof it takes and what happens in doubt were proposed to him)

## Context

The agent treated every issue as a task to carry out ([0076](0076-agent-for-any-labelled-issue.md)). For a bug it looked for the cause and said whether that was confirmed or a guess, but it had no outcome for a report that describes something the app does not do. Such a report ended in a change nobody needed or in a question.

## Options weighed

- What a rejection is: the verdict `agent: not possible` with the reason; a verdict of its own; a verdict of its own after which the agent closes the issue
- When a report counts as false: whenever the agent cannot make it happen, or only on proof
- Which issues are verified: those marked as a bug only, or also those whose text describes a bug without a doubt

## Decision

The agent verifies an issue that reports a bug: one with the label `bug` or the heading "What happened", or one whose text describes without a doubt something that goes wrong. In doubt it is a wish, and is built.

A report is confirmed, shown false or not verifiable. Shown false takes proof: a passing test that does exactly what the report describes, a use case or decision that says the app should do what it does, or the commit or version that repaired it since. Then the verdict is `agent: not a bug`: a comment with the proof, no pull request, and the issue stays open and is assigned to the owner. The agent still closes nothing.

A report that needs a device, the scanner or live data, or that the agent could not make happen, is never rejected: the agent repairs it on a likely cause and calls that a guess, or asks the owner for what is missing. When the owner answers a rejected report and sets `investigate` again, the agent takes his word that it happens.

The Feedback page shows the new verdict as its own stage.

## Consequences

The label `agent: not a bug` is made once by the owner. The complexity of a rejected report is "not applicable" and its severity is what it would be if the report were true ([0113](0113-agent-estimates-complexity-and-severity.md)). A real bug that the agent cannot reproduce costs a question instead of being dropped.
