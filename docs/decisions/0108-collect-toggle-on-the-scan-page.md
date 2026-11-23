# 0108. A toggle on the scan page makes a phone scan collect the product from the list

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner (remark 31, issue 71)

## Context

A scan adds a product to the list ([0001](0001-own-shopping-list.md)). In the shop the owner wants the opposite: scan the product with the phone to take it off the list. A first build made this a mode of the whole system, switched on the System page and followed by the handheld scanner. The owner rejected it: the toggle belongs in the scanner of the web app, nowhere else.

## Options weighed

- **Where the toggle lives**: a setting on the server that every scanner follows, or a toggle on the scan page that only that phone's scans follow. The owner chose the scan page.
- **How the server learns it**: a stored mode, or a mark sent with each scan. A mark per scan needs no stored state and cannot be left on by accident for the handheld scanner.
- **A scan of a product that is not on the list**: add it as bought, or leave it alone. The issue says it "only moves items from my list to recent".
- **An unknown barcode**: the usual inbox and naming, or a separate flow. The naming prompt already picks an existing product or creates one.
- **How long the toggle stays on**: remembered on the device, or until the app is closed. Left on by accident it would stop scans at home from adding, so it is not remembered.

## Decision

- The scan page has a toggle. While it is on, the page sends `collecting: true` with each scan. The server keeps no mode. The handheld scanner always adds, as before.
- The toggle stays on while the app is open, also when the user visits another page, and is off when the app starts.
- A collecting scan of a known barcode whose entry is *to buy* moves it to *recent* (result `collected`, quantity 0). A product that is not on the list, or already recent, is left alone (result `not_on_list`). Nothing is ever added.
- An unknown barcode still goes to the inbox as a `needs_name` scan, and the scan remembers that it was collecting (`scan.collecting`). Naming it applies the waiting scan as a collect. The naming prompt opened from the scan page shows the products to buy as quick picks while the toggle is on; searching and creating a new product work as before. A product that is not on the list stays off the list: the barcode is linked and nothing else changes.
- Undo restores the entry of a `collected` scan; a `not_on_list` scan changes nothing, so its undo only marks it undone.
- The buzzer gets no new sounds: these results only come from the phone.

## Consequences

- New column `scan.collecting` (one migration).
- `ScanResult` grows by `collected` and `not_on_list`.
- A typed code on the scan page follows the toggle too.
