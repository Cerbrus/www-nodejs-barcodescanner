# 0057. List entries have their own id; product plus note is unique

- Status: accepted
- Date: 2026-11-15
- Decided by: the owner (built as step 2 of the naming plan)

## Context

An entry added without a connection needs no answer from the server.

## Options weighed

Not recorded.

## Decision

A list entry has its own id, a UUID the web app makes. Product plus note is unique; when a change gives an entry the note of another entry of the same product, the server merges them, quantities added when both are to buy. The search on the list page shows every line of a found product that is to buy, with its note and "+1", and a plain tile that starts a new line when the product has no line without a note (owner, 2026-11-15). A scan of a barcode with a variant adds to the entry of that product with that note.

## Consequences

Offline changes rely on the ids, see [0081](0081-offline-snapshot-and-outbox.md).
