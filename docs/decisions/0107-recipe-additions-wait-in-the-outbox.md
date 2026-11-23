# 0107. Without a connection, a recipe addition waits in the outbox

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

The list works without a connection through a snapshot and an outbox of list changes ([0081](0081-offline-snapshot-and-outbox.md)). The web app can read a recipe code and build the tick sheet by itself ([0104](0104-shared-library.md)). Putting a recipe on the list is one history line with one undo ([0102](0102-putting-a-recipe-on-the-list.md)).

## Options weighed

- **Adding needs a connection**: the buttons are off without one. The smallest build.
- **The addition waits in the outbox** as a change of its own kind.
- **Fall back to plain list changes**: works with the outbox as it is, but those additions get no history line and no single undo.

## Decision

A recipe addition made without a connection waits in the outbox as its own kind of change and is applied when the connection is back, with its history line. Recipes and their codes can be viewed from the snapshot.

## Consequences

The outbox and the route that takes offline changes learn a second kind of change, and the rule that the server wins on a conflict has to say what that means for a recipe addition. This is built last.
