# Findings and proposal: look up barcodes for a product

Item 10 of [plan.md](plan.md): while editing a product, search for barcodes that belong to it and assign them by hand, without scanning a package. This is what the two sources behind the connectors give when asked by name, tried on 2026-11-28, and a proposal for what to build. The owner chose on 2026-11-28 ([0134](decisions/0134-barcodes-looked-up-by-name.md)) and it was built that day; what differs from the proposal is under "What the owner chose".

## What the sources give

**Albert Heijn can be searched by name, but gives no barcode.** `GET https://api.ah.nl/mobile-services/product/search/v2?query=<words>` with the anonymous token the connector already asks for answers with products: the shop's own product number, title, brand, pack size and pictures. `halfvolle melk` gave 68 products. No barcode is in that answer, and the route that used to give the details of one product with its barcode (`tradeItem.gtin` in `ah/product-details.model.ts`) answers 404 for every version tried. The shop's web page of a product refuses a request from a script (403). So Albert Heijn goes one way only: from a barcode to a product, which the connector does today.

**Open Food Facts can be searched by name and gives barcodes.** Its old search (`/cgi/search.pl`) answered 503, "not available to anonymous users". Its newer search service does answer, without a login and within 10 milliseconds on its side:

```
GET https://search.openfoodfacts.org/search?q=<words> countries:"en:netherlands"&langs=nl&page_size=6&fields=code,product_name,brands,quantity
```

Each hit holds the barcode, the name, the brands and the pack size. The filter on the country is needed; without it Belgian products come first.

| Asked               | Hits in the Netherlands | Of the first six, known to Albert Heijn by that barcode |
| ------------------- | ----------------------- | ------------------------------------------------------- |
| `pindakaas`         | 266                     | 1                                                       |
| `hagelslag melk`    | 29                      | 4                                                       |
| `AH halfvolle melk` | 3                       | 2 of 3                                                  |
| `olijfolie`         | 242                     | 1                                                       |
| `afwasmiddel`       | 54                      | 0                                                       |

What that says:

- A search by a product's plain name gives too much: every brand and size of peanut butter. The product's name alone does not say which pack is in the house. The owner has to pick, and a brand in the search words narrows it well (`AH halfvolle melk`: 3 hits).
- The data is written by volunteers. Some hits carry a code a shop made up for its own scales or shelf (`0000210066210`, `00156211`), which is on no package elsewhere. Some have no size. A barcode Albert Heijn knows too is the surest: both sources agree on it.
- Non-food is poor: of the first six hits for washing-up liquid none is known to Albert Heijn, and four carry a code a shop made up.
- It is one more unofficial source in use. The search service is younger than the product route the connector uses, and may change.

## Proposal

A search on the product's page that offers barcodes; the owner ticks the ones that are this product.

1. **The connector model gets an optional `search(words)`** beside `lookup(code)`, answering barcodes with a title, brand and size. Only the Open Food Facts connector has it. A failure gives an empty list and a line in the log, as a failed lookup does.
2. **`GET /api/v1/barcode-candidates?query=<words>`**: the connector service asks every connector that can search, then asks the others (Albert Heijn) for each barcode found, at most six, in parallel, as it does for a scan. The answer per barcode: the code, each source's title, brand and size, and the product the barcode already belongs to, if any.
3. **The product's page** gets a search button in its barcode part. It opens a sheet with a field that starts with the product's name, and the hits as rows: title, brand, size, a sign for "Albert Heijn knows it too", and a tick box. A barcode that belongs to another product shows that product's name and cannot be ticked. Saving maps each ticked barcode to the product through the route the naming prompt uses (`PUT /api/v1/barcodes/:code`), with the suggestions that were found stored on the barcode.
4. **Tests**: the connector against a stand-in for the search, the route over HTTP, the sheet in Vitest, and one browser test with a stand-in connector.

## What the owner chose

- **Build it**, for every account, as with naming a barcode.
- **The variant**: a note per ticked barcode, proposed by the app from what the title says beside the product's name, and free to change.
- **Codes a shop made up**: shown, at the end of the hits. A code of 8 digits is a barcode of a small package and keeps its place, so such a code is one that starts with `00` or `2`, or is not 8 or 13 digits long.

What was built differently from the proposal:

- The search asks for ten hits instead of six, and the other sources are asked about every hit that is no code a shop made up.
- The route also takes the product, `catalogItemId`, for the proposed variant.
- The suggestions are not sent along when a barcode is linked. The app looks a linked barcode up once itself when it never was, so nothing a browser sends is stored as what a source said.
- The browser test stands in for the answer of the search route, not for a connector; the connector and the route have their stand-ins in the API's own tests.
