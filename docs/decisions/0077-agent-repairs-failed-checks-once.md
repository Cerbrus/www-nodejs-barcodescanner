# 0077. The agent repairs a failed build once

- Status: accepted
- Date: 2026-11-20
- Decided by: the owner (after pull request 43 arrived with a failing check)

## Context

The cause that time was a file Prettier had not formatted; the agent's rules forbade running a formatter, from before Prettier checked the whole code base.

## Options weighed

- The owner repairs it
- One more agent run
- A loop of repairs (each run counts against the owner's Claude plan)

## Decision

The workflow waits for the build checks of the agent's pull request, and when they fail the agent gets one more run to repair them, with the failed output. When they still fail the owner is told and the issue is labelled `agent: checks failed`. One repair, not a loop.

## Consequences

The agent's rules now tell it to format the files it changed.
