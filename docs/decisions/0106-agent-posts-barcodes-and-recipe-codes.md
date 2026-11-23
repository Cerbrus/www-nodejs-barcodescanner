# 0106. The hardware agent rebuilds the typed text and posts only barcodes and recipe codes

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

The agent keeps the digit keys of a scan and ignores Shift, so a code with punctuation posts stray digits: a test code with every ASCII character landed in the inbox as barcode `1345790826` (2026-11-23). The scanner types as a US keyboard, with Shift for capitals and symbols and Alt plus keypad digits for characters outside ASCII ([0100](0100-recipes-as-qr-codes.md)). The agent holds a scan while the app is unreachable ([0021](0021-agent-holds-offline-scans.md)).

## Options weighed

- The agent decides what is worth posting.
- The agent posts every text and the API decides. A thinner agent, but every stray QR code reaches the API and the history.

## Decision

The agent rebuilds the whole typed text with a US key map and Shift. Then:

- **6 to 14 digits and nothing else**: a barcode, posted as before.
- **Starts with `R`, a digit and `;`**: a recipe code, posted to the same `/scans` route and held and replayed the same way when the app is away.
- **Anything else**, such as a web address, or a scan that holds Alt codes: not posted. The `error` sound plays and one log line holds the first 40 characters.

The agent does not read the recipe; it only recognises the prefix.

## Consequences

- A code that is not a barcode no longer becomes a junk barcode in the inbox.
- Until the API knows recipes, it refuses a recipe code and the agent plays the `error` sound.
- The agent learns the scan results `recipe` and `recipe_partial` for its sounds ([0102](0102-putting-a-recipe-on-the-list.md)).
