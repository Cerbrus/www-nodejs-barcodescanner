# 0064. Remarks are stored in the app's own database; only the owner sends them to GitHub

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner

## Context

Reasoning in [archive/remarks-plan.md](../archive/remarks-plan.md). The repository is public, so sending to GitHub is the privacy gate.

## Options weighed

Not recorded.

## Decision

Remarks are stored in the app's own database. Every account may write them and sees its own; the owner sees all. Only the owner sends a remark to GitHub, after seeing what goes out. The account and the device details stay out unless ticked.

## Consequences

In the code a remark is a remark, not "feedback", which already means the sounds at the scanner.
