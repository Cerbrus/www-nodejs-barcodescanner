# 0100. A recipe is a QR code that carries its whole ingredient list

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner

## Context

The owner wants recipes: a list of ingredients that lands on the shopping list with one scan. Recipes are stored and managed in the app, and each one can be printed as a code.

The handheld scanner turned out to read QR codes (tested 2026-11-23). It works as a keyboard, so what it can pass on is what it can type. Tests on the Pi with codes drawn by `qrcode-generator` 2.0.4 showed:

- All 95 printable ASCII characters arrive exactly, as key presses of a US keyboard layout with Shift.
- A line feed and a carriage return inside a code are typed as Enter, a tab as Tab. Each ends the scan, so a code with one arrives as several scans.
- Accented letters in UTF-8 arrive as Alt plus a number on the numeric keypad, two bytes per code. That worked for two-byte characters; a euro sign at the end of a short code was lost twice.
- A code of 450 characters is read from a screen at the first try and typed in 2.2 seconds.
- A code split into numeric and byte segments types the same text as one byte segment.

The hardware agent keeps digit keys only and ignores Shift and Alt. A code with punctuation therefore posts stray digits as a barcode today.

## Options weighed

- **What the code holds**: the whole recipe, or a pointer to the stored recipe. A pointer is small and always current, but breaks when the database is reset or the recipe is deleted.
- **What names an ingredient**: a barcode, the product's id, or the product's name. A barcode leaves out products without one and brings its own stored note into conflict with the recipe's note. A name is tied to a language. An id changes when the database is rebuilt without a restore; the hourly backup keeps the ids.
- **How text gets through the scanner**: digits only with text encoded as numbers, plain text with non-ASCII characters escaped, or raw UTF-8 decoded from the Alt codes. The Alt codes depend on the character's position and length.
- **Compression**: deflate with Base64 or Base45 around it. For 20 ingredients with barcodes it brought the code from 81 to 61 modules a side, for 6 ingredients almost nothing, and the text becomes unreadable. With product ids the text is already short.
- **How the app tells a recipe from a barcode**: a short prefix with a version, a web address the phone's own camera app opens, or a prefix without a version.
- **The library that draws the code**: `qrcode-generator` (no dependencies, own types, hands out the grid of modules) or `qrcode` (depends on `pngjs` and `yargs`, no own types).

## Decision

A recipe code is plain text:

```
R1;Pasta pesto;45*2:volkoren;112*2:rood;87
```

- `R1;` says it is a recipe in format version 1. A later format gets `R2;` and the app keeps reading both.
- The title follows, then the ingredients, separated by `;`.
- An ingredient is the product's id, then optionally `*` and a quantity (1 when left out), then optionally `:` and a note. The note is the variant the product goes on the list under.
- In the title and the notes, `;`, `%` and every character outside printable ASCII are percent-escaped. The code holds ASCII only and has no line breaks or tabs.
- No compression and no Base64.
- The app draws the code with `qrcode-generator`, as one byte segment.
- The code carries the whole recipe. Scanning it adds what is in the code, whether or not the app has that recipe stored. A code of a recipe the app does not know is offered for saving, through the inbox.
- An ingredient whose product id the app does not know is left out and reported; the rest of the recipe is added.
- A quantity counts as that many scans of the product: a product that is already to buy goes up by it.

## Consequences

- A printed code is stale after its recipe is edited and adds the old ingredients until it is printed again.
- After a database reset without a restore, an id in a printed code can point at another product without a warning. A restore from the backup keeps the ids.
- The hardware agent has to read letters and punctuation with Shift, and must stop counting a shifted digit key as a digit.
- The scan route accepts 6 to 14 digits only, so a recipe needs its own way into the API.
- The phone's camera page reads the same text through `@zxing/browser`.
- Still to be decided, each with its own plan: the recipe table and pages, the Products tab moving to Settings to make room for Recipes, and how a recipe scan shows in the history and is undone.
