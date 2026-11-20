# 0004. An unknown barcode goes to the inbox

- Status: accepted
- Date: 2026-11-12
- Decided by: the owner (feature review)

## Context

The user chose a clean list over placeholders.

## Options weighed

- Placeholder items on the list
- Inbox only

## Decision

Inbox only; nothing on the list until named. A web scan prompts at once. A handheld scan sends a notification to the phone; a sound signal is still planned.

## Consequences

The notification is [0022](0022-web-push.md). The sound signal became the buzzer, see [0015](0015-sound-feedback-buzzer.md).
