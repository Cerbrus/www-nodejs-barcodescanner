# 0096. In the code, feedback from inside the app is called a remark

- Status: accepted
- Date: not recorded (found afterwards, 2026-11-20)
- Decided by: not recorded
- Found afterwards: yes

## Context

Found afterwards: this choice was made but never written down. Source: `CLAUDE.md` in short.

## Options weighed

Not recorded.

## Decision

The code says `RemarkService`, `/api/v1/remarks` and the `remark` table, because "feedback" already means the sounds at the scanner.

## Consequences

Some older names (`feedback` events, the Feedback page) still use the word for both. See [0064](0064-remarks-in-own-database.md).
