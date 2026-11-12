# Use cases

One user, one household list. Login is handled by the reverse proxy, so the app has no accounts.

Terms:

- **Catalog item**: a generic product such as "Melk", with a shop section and an icon.
- **Barcode mapping**: the link from one barcode to one catalog item. Made once, by the user.
- **List entry**: a catalog item on the shopping list, in state *to buy* or *recent*, with a quantity and a note.
- **Inbox**: scanned barcodes that have no mapping yet.

## Scanning

### UC-1 Scan a known product with the handheld scanner

1. The user scans an empty package with the handheld scanner connected to the Pi.
2. The catalog item moves to *to buy* with quantity 1. If it is already *to buy*, the quantity goes up by one.
3. The Pi gives the "OK" feedback signal, once feedback hardware is chosen.
4. Any open web page shows a toast with the item name and an undo button.

A second read of the same barcode within 3 seconds is ignored.

### UC-2 Scan a new product with the handheld scanner

1. The user scans a barcode that has no mapping.
2. Nothing is added to the list. The scan goes to the inbox.
3. All product connectors are queried in parallel; their results are stored as suggestions.
4. The Pi gives the "needs naming" feedback signal. Open web pages show the naming prompt.
5. The user names it later (UC-5). The waiting scans are then applied to the list.

### UC-3 Scan with the phone camera

1. The user opens the scan page on the phone. The camera stays open.
2. A known barcode is added at once (same rules as UC-1), with a toast and an undo button.
3. An unknown barcode pauses scanning and opens the naming prompt (UC-5). After naming, the item is added and scanning resumes.

### UC-4 Undo the last scan

1. The user taps undo on the toast or on the history page.
2. The effect of the last scan is reversed: the quantity goes down by one, or the entry returns to its previous state.

## Naming

### UC-5 Name a barcode (once per barcode)

1. The prompt shows the barcode and every connector suggestion (title, brand, category, photo).
2. The user picks an existing catalog item from a search box. The suggested category narrows the choice.
3. If no item fits, the user creates one: name, shop section, icon. The section is prefilled from the suggestions.
4. The mapping is saved. Every later scan of this barcode is automatic.

### UC-6 Manage mappings and catalog

Each catalog item has its own management page:

- It shows the item's name, section and icon, and every barcode attached to it. Each barcode is drawn as a scannable image with its number, the product title a connector suggested, how often it was scanned and when it was last scanned.
- Rename the item, change its section or icon, or delete it.
- Move a barcode to a different catalog item, or detach it. A detached barcode returns to the inbox on its next scan.

The drawn barcode is there to recognise which package a number belongs to, and to rescan it from the screen with the handheld scanner when testing.

## Shopping list

### UC-7 Shop from the list

1. The list page shows *to buy* tiles grouped by shop section, each with icon, name, quantity and note.
2. Tapping a tile checks it off: it moves to *recent* and its quantity resets.
3. Without a connection, the page shows an offline banner. Offline use is a later milestone.

### UC-8 Add or edit by hand

- Tap a *recent* tile to put it back on the list.
- Search the catalog and add an item without scanning.
- Change the quantity with plus and minus, and edit the note.

## Oversight

### UC-9 Scan history

A page lists recent scans: time, source (handheld or phone), barcode, result (added, counted up, needs naming, ignored, undone). It is also the debugging view.

### UC-10 Hands-off updates

1. A change is pushed to `master`.
2. GitHub Actions builds new images.
3. Within minutes the Pi pulls them and restarts the app, with no action from the user. Data survives the update.
