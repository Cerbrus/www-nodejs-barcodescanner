# 0108. Shopping mode: a scan collects the product from the list

- Status: accepted
- Date: 2026-11-23
- Decided by: the owner (remark 31, issue 71)

## Context

A scan adds a product to the list ([0001](0001-own-shopping-list.md)). In the shop the owner wants the opposite: scan the product to take it off the list. The handheld scanner has no screen and posts to the API, so the mode cannot live in one browser.

## Options weighed

- **Where the mode is kept**: in the browser, or on the server. The handheld scanner is only known to the server, so it is the server.
- **A scan of a product that is not on the list**: add it as bought, or leave it alone. The issue says the mode "only moves items from my list to recent".
- **An unknown barcode**: the usual inbox and naming, or a separate flow. The naming prompt already picks an existing product or creates one.
- **Who may switch it**: every account, like the list, or only the owner.

## Decision

- Shopping mode is one setting on the server (table `setting`, key `shopping_mode`), switched on the System page by every account, and shown as a banner in every page while it is on. The Pi and every open page follow it through the `shopping_mode` event.
- In the mode a scan of a known barcode whose entry is *to buy* moves it to *recent* (result `collected`, quantity 0). A product that is not on the list, or already recent, is left alone (result `not_on_list`). Nothing is ever added.
- An unknown barcode still goes to the inbox as a `needs_name` scan, and the scan remembers that it was made while shopping (`scan.collecting`). Naming it applies the waiting scan as a collect, whatever the mode is at that moment. The naming prompt shows the products to buy as quick picks while the mode is on; searching and creating a new product work as before. A product that is not on the list stays off the list: the barcode is linked and nothing else changes.
- Undo restores the entry of a `collected` scan; a `not_on_list` scan changes nothing, so its undo only marks it undone.
- Two new sound events, `collected` and `not_on_list`, with their own default sounds, chosen like the others.
- A recipe code scanned in the mode is still put on the list as before; shopping mode concerns product barcodes.

## Consequences

- New table `setting` and column `scan.collecting` (one migration).
- `ScanResult` and the sound events grow by two; the hardware agent learns both.
- Turning the mode off does not touch the list.
