# 0134. Barcodes of a product can be looked up by name and linked by hand

- Status: accepted
- Date: 2026-11-28
- Decided by: the owner

## Context

A barcode gets its product at its first scan ([0003](0003-confirm-first-scan.md)), so a product learns a package only once that package is empty and scanned. The owner asked whether the barcodes of a product can be found without a scan, while editing the product. What the two sources give when asked by name was tried on 2026-11-28 and is written down in [barcode-lookup-plan.md](../barcode-lookup-plan.md): Albert Heijn can be searched by name but gives no barcode; the newer search service of Open Food Facts gives barcodes by name, well for food with a brand in the search words, poorly for plain names and non-food, and some of its hits carry a code a shop made up for its own scales or shelf.

## Options weighed

- **Build it at all**, or leave scanning the empty package as the only way.
- **Who may search**: every account, as with naming a barcode, or the owner only.
- **The variant of a linked barcode**: empty, one note for all ticked barcodes, or a note per barcode that the app proposes.
- **Codes a shop made up** (starting with `00` or `2`, or shorter than 13 digits): hide them, hide them but keep codes of 8 digits, or show them.
- **What the app keeps of a search**: nothing until a barcode is linked, or a row per hit.

## Decision

**The product's page gets a search for barcodes.** It opens a sheet with a search field that starts with the product's name, and the hits of Open Food Facts for products sold in the Netherlands, at most ten.

**Every account may search**, as every account names a barcode.

**Each hit is a row with a tick box**: the title, the brand, the size and the barcode, and the logo of every source that knows the barcode. The other sources, today Albert Heijn, are asked about each hit, so a barcode both know is recognisable.

**A ticked row shows its variant, proposed by the app and free to change.** The proposal is what a source's title says beside the product's name, by the naming rules ([0056](0056-naming-sections-variants.md)); the first source that says more than the name gives it.

**A code a shop made up is shown, at the end of the hits.** That is a code that starts with `00` or `2`, or is not 8 or 13 digits long: a code of 8 digits is the barcode of a small package and keeps its place. The other sources are not asked about a code a shop made up.

**A barcode that belongs to a product already has no tick box** and names that product. Moving a barcode stays the work of its own product's page.

**Nothing is kept of a search.** Linking a ticked barcode goes through the route the naming prompt uses; a barcode that was never looked up is then looked up once, so it carries its suggestions like a scanned one.

## Consequences

- The connector model gets an optional search beside the lookup; only the Open Food Facts connector has one. A search that fails gives no hits and a line in the log, and never an error for the user ([0080](0080-failures-never-fail-a-scan.md)).
- The search service of Open Food Facts is one more unofficial dependency, younger than the product route. When it changes, the sheet finds nothing and scanning remains.
- The search words leave the app for Open Food Facts, and each barcode found for Albert Heijn. Only letters, digits, spaces, hyphens and apostrophes of the words are sent, so the words cannot change what is searched.
- A barcode linked this way has no scans: its counter is 0 until the package is scanned.
- Albert Heijn's anonymous token is now asked for once when several lookups start together.
