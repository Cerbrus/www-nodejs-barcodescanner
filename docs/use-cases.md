# Use cases

One user, one household list. The user logs in with a Google account that is on the app's allowlist (UC-17).

Terms:

- **Catalog item** (product): a generic product such as "Melk", with a shop section and an icon.
- **Barcode mapping**: the link from one barcode to one catalog item. Made once, by the user.
- **List entry**: a catalog item on the shopping list, in state *to buy* or *recent*, with a quantity and a note.
- **Inbox**: scanned barcodes that have no mapping yet.

## Scanning

### UC-1 Scan a known product with the handheld scanner

1. The user scans an empty package with the handheld scanner connected to the Pi.
2. The catalog item moves to *to buy* with quantity 1. If it is already *to buy*, the quantity goes up by one.
3. Any open web page shows a toast with the item name and an undo button. For an unknown barcode the toast offers to name it.

A second read of the same barcode within 1 second is ignored. A buzzer at the scanner beeps the result (UC-16). When the app is not reachable, for instance during an update, the scan is kept and added a moment later; the buzzer plays its own "kept" sound, so there is no need to scan again.

### UC-2 Scan a new product with the handheld scanner

1. The user scans a barcode that has no mapping.
2. Nothing is added to the list. The scan goes to the inbox.
3. All product connectors are queried in parallel; their results are stored as suggestions.
4. Open web pages show the inbox count on the navigation. A phone with notifications on gets a notification (UC-12).
5. The user names it later (UC-5). The waiting scans are then applied to the list.

### UC-3 Scan with the phone camera

1. The user opens the scan page on the phone. The camera stays open; a code can also be typed.
2. A known barcode is added at once (same rules as UC-1), with a toast and an undo button.
3. An unknown barcode pauses the camera and opens the naming prompt (UC-5). After naming, the item is added and scanning resumes.

### UC-4 Undo the last scan

1. The user taps undo on the toast or on the history page.
2. The effect of the last scan is reversed: the quantity goes down by one, or the entry returns to its previous state.

## Naming

### UC-5 Name a barcode (once per barcode)

1. The prompt shows the barcode and every connector suggestion (title, brand, category, photo, and the logo of the source it came from). When a source gave no answer, the prompt says which one and offers to try again. Tapping a suggestion copies its title into the search field and marks that suggestion with a coloured border and a check mark.
2. The user picks an existing catalog item from the search field, which lists matches while typing.
3. If no item fits, the user chooses "new product" in the same list and fills in the form: name, shop section, icon from a visual picker, emoji. The section is guessed from the suggestions and the name.
4. "Later" leaves the barcode in the inbox. "Cancel scan" discards the waiting scans and removes the barcode from the inbox.
5. The mapping is saved. Every later scan of this barcode is automatic.

The inbox page lists every waiting barcode and opens the same prompt.

### UC-6 Manage products and mappings

The products page lists every catalog item as a tile, in collapsible shop sections, with a search field. Each catalog item has its own management page:

- It shows the item's name, section and icon, and every barcode attached to it. Each barcode is drawn as a scannable image with its number, the product title a connector suggested, how often it was scanned and when it was last scanned.
- Rename the item, change its section, emoji or icon, or delete it. The icon picker shows the icons as a searchable grid; "none" comes first, then the product's standard icon from the seed data when it has one.
- Move a barcode to a different catalog item, or detach it. A detached barcode returns to the inbox on its next scan.

The drawn barcode is there to recognise which package a number belongs to, and to rescan it from the screen with the handheld scanner when testing.

## Shopping list

### UC-7 Shop from the list

1. The list page shows *to buy* tiles in red, grouped by shop section, each with icon, name, quantity and note. *Recent* tiles follow in green.
2. Tapping a red tile checks it off: it moves to *recent* and its quantity resets. A toast offers to undo it, which puts the product back with its quantity and note.
3. Without a connection the app still opens and shows the list as it was last loaded, with a banner saying from when it is; when the connection returns it reloads by itself. Checking off, putting a recent product back, and changing quantity or note work without a connection: the tile changes at once and shows a small clock until the change has been sent. The banner counts the changes that wait. If the same product was changed at home in the meantime, for instance by a later scan, that later change wins and a toast says the list was updated from the server.

### UC-8 Add or edit by hand

- Tap a *recent* tile to put it back on the list.
- Search the catalog and add an item without scanning.
- When the search finds no exact match, create the product from there: name, section, icon, emoji. It goes on the list at once.
- Open a tile's menu to change the quantity with plus and minus, edit the note, or jump to the product's management page.
- At quantity 1 the minus button takes the product off the list and moves it to *recent*, the same as checking it off.
- A *recent* tile has a menu too: put it on the list, edit the product, or remove it from *recent* after a confirmation. Removing only clears it from the list page; the product and its barcodes stay.

## Oversight

### UC-9 Scan history

A page lists recent scans: time, source (handheld or phone), barcode, result (added, counted up, needs naming, ignored, undone). It also undoes the last scan, and it is the debugging view.

### UC-10 Hands-off updates

1. A change is pushed to `master`.
2. GitHub Actions checks it and builds new images.
3. Within minutes the Pi pulls them and restarts the app, with no action from the user. Data survives the update, and open pages reconnect by themselves.

### UC-11 Scanner and system log

A page shows a live log of what the system is doing, in a monospaced, terminal-like view: scanner connected or lost, every raw read with its result, connector lookups and failures, notifications sent, start-up and seed messages. New lines appear as they happen; the page starts with the most recent few hundred lines, also after a restart. It answers "did my scan arrive, and what happened to it" without SSH.

### UC-12 Notification for an unknown product

1. On the System page the user turns on notifications for the phone, once, and can send a test notification.
2. Later, someone scans a package with the handheld scanner and the barcode has no name yet.
3. The phone shows a notification with the product name the supermarket knows, and the app icon shows how many barcodes wait in the inbox.
4. Tapping the notification opens the inbox, where the barcode gets its name.

### UC-13 Nothing lost when the Pi dies

1. Every hour in which something changed, the Pi pushes the database as readable SQL to a private repository.
2. After a dead SD card the user installs the app on a new card, loads the latest dump and has the catalog, mappings, list and history back, missing at most the last hour.

### UC-16 Choose the scanner sounds

1. A buzzer at the scanner beeps after every handheld scan: by default a short beep for a product added, two blips for counted up, a long beep for an unknown barcode, three beeps when the scan did not arrive.
2. On the System page the user picks, per event, a sound from a list or "no sound". The choice is saved and played at once on the buzzer.
3. A button per sound plays it, to compare them and to check the buzzer works.

## Using it as an app

### UC-14 Install on the phone

The user adds the site to the home screen from the browser's share menu. It then opens full screen with its own icon and name, and can receive notifications.

### UC-17 Log in

1. Opening the site without a session shows a login page with one button, "Log in with Google".
2. The user picks a Google account. An account on the allowlist gets in and stays logged in on that device for 90 days, longer when the app is used.
3. Any other account is sent back with "this Google account has no access".
4. The System page shows the account and a red logout button, which asks for confirmation.

### UC-15 Language and appearance

On the System page every account picks Dutch or English and automatic, light or dark appearance, both remembered per device, turns notifications for its device on or off, and sees its account with the logout button.

The owner sees more there: scan history, system log, sounds at the scanner, the test notification, and the status with the live connection, the handheld scanner, its last scan and the running version. Other accounts do not see those parts, and the server refuses them the data behind them.
