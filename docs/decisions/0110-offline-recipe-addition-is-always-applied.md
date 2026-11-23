# 0110. A recipe addition made without a connection is always applied, at the moment it was made

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

A recipe addition made without a connection waits in the outbox ([0107](0107-recipe-additions-wait-in-the-outbox.md)). For a change to a list entry the server wins: a change is skipped when that entry was changed on the server after the change was made ([0081](0081-offline-snapshot-and-outbox.md)). That decision left open what the rule means for a recipe addition, which touches several entries and only ever adds.

## Options weighed

- **Skip the recipe, or the products of it, whose entry changed on the server since.** The same rule as for an entry, but a recipe that arrives half or not at all is hard to notice in the shop.
- **Always apply.** An addition does not overwrite anything: it adds its quantity to whatever the entry holds by then.

## Decision

A waiting recipe addition is always applied when the connection is back, on top of what the list holds at that moment. There is no conflict to lose. Its history line carries the moment the button was tapped, within the hour the server accepts for a held scan; an older one gets the moment it arrived.

The outbox is sent in the order it was filled: list changes before a recipe go first, then the recipe, then what came after it.

A request whose answer got lost is sent again. The server recognises an addition with the same recipe content and the same moment and answers with the scan it already has, so the recipe is on the list once. This holds within the hour above.

An addition the server refuses is dropped from the outbox with the message that the list was updated from the server, so it cannot block the changes behind it.

## Consequences

- The buttons that put a recipe on the list, and the tick sheet of the camera page, work without a connection. The list shows the products at once; the banner counts the addition as one waiting change. There is no undo in the message until it has been sent.
- An addition dated in the past is not the latest scan when something was scanned at home in the meantime; undo then takes that later scan first.
- `POST /api/v1/recipes/additions` accepts `addedAt`.
