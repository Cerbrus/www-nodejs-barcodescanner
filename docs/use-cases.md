# Use cases

One user, one household list. The user logs in with a Google account that is on the app's allowlist (UC-17).

Terms:

- **Catalog item** (product): a generic product such as "Melk", with a shop section and an icon.
- **Barcode mapping**: the link from one barcode to one catalog item. Made once, by the user.
- **List entry**: a catalog item on the shopping list, in state _to buy_ or _recent_, with a quantity and a note.
- **Inbox**: scanned barcodes that have no mapping yet.

## Scanning

### UC-1 Scan a known product with the handheld scanner

1. The user scans an empty package with the handheld scanner connected to the Pi.
2. The catalog item moves to _to buy_ with quantity 1. If it is already _to buy_, the quantity goes up by one. A barcode named with a variant (UC-5) goes to the line of that product with that note.
3. Any open web page shows a toast with the item name and an undo button. For an unknown barcode the toast offers to name it.

A second read of the same barcode within 1 second is ignored. A buzzer at the scanner beeps the result (UC-16). When the app is not reachable, for instance during an update, the scan is kept and added a moment later; the buzzer plays its own "kept" sound, so there is no need to scan again.

A code that is not a product barcode, such as a QR code with a web address, adds nothing: the buzzer plays the error sound and the system log holds the first characters of what was read.

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

### UC-23 Collect products while shopping

1. In the shop the user turns on the toggle on the scan page. It stays on while the app is open and is off when the app starts.
2. A scan with the phone of a product that is _to buy_ moves it to _recent_, whatever its quantity. A toast offers undo. A product that is not on the list, or is already recent, is left alone and the toast says so; nothing is added.
3. An unknown barcode opens the naming prompt as usual. It offers the products on the list to pick from, or the search to pick or create another product. The product picked is collected if it is on the list; a product that is not on the list stays off it, and only the barcode learns its product.
4. The handheld scanner does not follow the toggle: it always adds.

A barcode scanned with the toggle on but named later, from the inbox, is still collected, not added.

### UC-4 Undo the last scan

1. The user taps undo on the toast or on the history page.
2. The effect of the last scan is reversed: the quantity goes down by one, or the entry returns to its previous state.

## Naming

### UC-5 Name a barcode (once per barcode)

1. The prompt shows the barcode, a proposal, and every connector suggestion (title, brand, category, photo, and the logo of the source it came from). When a source gave no answer, the prompt says which one and offers to try again. Tapping a suggestion copies its title into the search field and marks that suggestion with a coloured border and a check mark.
2. The proposal names the existing product the shop title mentions, the most specific one first ("AH Geraspte kaas" gives Geraspte kaas), or a more generic one with the rest of the title as variant ("AH Jonge kaas 48+" gives Kaas, variant Jonge), or a new name without brand and amount. One tap links it, with the variant field filled in from the proposal and still editable; for a new name the tap opens the new product form. Otherwise the user picks an existing catalog item from the search field, which lists matches while typing. The proposal's variant belongs to the proposal: it leaves the variant field as soon as the search field has text, so another product is never linked with it, and the field always shows what will be kept. A variant the user typed, such as "volkoren", stays whatever is picked and is not replaced when the lookup answers later; it is kept with the barcode, whose scans go to the line of the product with that note.
3. If no item fits, the user chooses "new product" in the same list and fills in the form: name, shop section, icon from a visual picker, emoji. The section comes from the shop's category when a suggestion has one the app knows, and is otherwise guessed from the suggestions and the name.
4. "Later" leaves the barcode in the inbox. "Cancel scan" discards the waiting scans and removes the barcode from the inbox.
5. The mapping is saved. Every later scan of this barcode is automatic.

The inbox page lists every waiting barcode and opens the same prompt.

### UC-6 Manage products and mappings

The products page is for the owner and is reached from the Management group of the System page. It lists every catalog item as a tile, in collapsible shop sections, with a search field. Each catalog item has its own management page, which every account can still open from a product on the list:

- It shows the item's name, section and icon, and every barcode attached to it. Each barcode is drawn as a scannable image with its number, the product title a connector suggested, how often it was scanned and when it was last scanned.
- Rename the item, change its section, emoji or icon, or delete it. The bin sits next to Save and asks first, in the same row. Deleting a product that recipes use says how many, and takes it out of them. A tap on the product's icon, marked with a small pencil, opens the icon picker. The icon picker shows the icons as a searchable grid; "none" comes first, then the product's standard icon from the seed data when it has one.
- Move a barcode to a different catalog item, or detach it. A detached barcode returns to the inbox on its next scan.

The drawn barcode is there to recognise which package a number belongs to, and to rescan it from the screen with the handheld scanner when testing.

## Shopping list

### UC-7 Shop from the list

1. The list page shows _to buy_ tiles in red, grouped by shop section, each with icon, name, quantity and note. _Recent_ tiles follow in green.
2. Tapping a red tile checks it off: it moves to _recent_ and its quantity resets. A toast offers to undo it, which puts the product back with its quantity and note.
3. With a weak or missing connection the app opens from the page kept on the device, without waiting for the network, and with the last known login; the login check runs in the background and sends the app to the login page when the login ran out. Only on a device that never logged in does it wait for the login check, at most 5 seconds. Without a connection, or when the server does not answer within 5 seconds, the app still opens and shows the list as it was last loaded, with a banner saying from when it is; when the connection returns it reloads by itself. Checking off, putting a recent product back, and changing quantity or note work without a connection, and on a connection too weak to answer within 5 seconds: the tile changes at once and shows a small clock until the change has been sent. While the banner shows, the clock is there at once; only the first change on a connection that stops answering gets it after 5 seconds. The banner counts the changes that wait. If the same product was changed at home in the meantime, for instance by a later scan, that later change wins and a toast says the list was updated from the server.

### UC-8 Add or edit by hand

- Tap a _recent_ tile to put it back on the list.
- Search the catalog and add an item without scanning. Every line of a found product that is already on the list shows in the results in the list colour, with its note and "+1"; tapping one raises that line's quantity by one. A plain tile next to them starts a new line without a note, unless there already is one.
- A product can be on the list more than once, each line with its own note (Kaas: jong, belegen, cheddar). Give the line a note, then add the product again from the search for the next one. Giving a line the note of another line of the same product merges them, quantities added.
- When the search finds no exact match, create the product from there: name, section, icon, emoji. It goes on the list at once.
- Open a tile's menu to change the quantity with plus and minus, edit the note, or jump to the product's management page.
- At quantity 1 the minus button takes the product off the list and moves it to _recent_, the same as checking it off.
- A _recent_ tile has a menu too: put it on the list, edit the product, or remove it from _recent_ after a confirmation. Removing only clears it from the list page; the product and its barcodes stay.

## Recipes

### UC-20 Keep recipes

1. The Recipes tab lists the recipes by name, each with its number of products and as many of their icons as fit on the row (when there are more, the last two fade out), and a search field that filters on the name.
2. "New recipe" opens an empty form: a name, a description and the products. A product is picked with the product search, where a product that does not exist can be made; each is one line with its note and its quantity. Picking a product that is already in the recipe without a note counts it up; the minus of a product that is down to one is a bin that takes it out. The products are dragged by their row into the order they are saved and shown in.
3. A recipe opens to read: its name, the description shown as markdown, its products with quantity and note, and its code. The pencil at the top right turns it into the form; Save and Cancel go back to reading. The form ends in one row: cancel, save and, for an existing recipe, delete, which asks first in that same row.
4. Recipes are shared by every account.

### UC-21 Put a recipe on the list

1. The button on a recipe's row puts every product on the list at once. A product that is already to buy goes up by the recipe's quantity.
2. The button on the recipe's own page opens a sheet with every product ticked. The user unticks what is in the house and confirms; only the ticked products go on the list.
3. A message names the recipe and how many products went on the list, with an undo that takes the whole recipe back in one step.
4. Without a connection both buttons work: the products show on the list at once, the banner counts one waiting change, and the recipe is sent when the connection is back, with the moment of the tap in the history. The message then has no undo.

### UC-24 Scan a recipe code with the handheld scanner

1. The user scans the code of a recipe with the handheld scanner.
2. Every product of the recipe goes on the list, as with the button on a recipe's row. The buzzer plays the recipe sound, and open web pages show a message with the recipe's name and an undo.
3. A product in the code that no longer exists is left out. The buzzer then plays its own sound, the message says how many are unknown, and a phone with notifications on gets a notification.
4. A recipe the app does not have, or no longer has in this form, is offered in the inbox with its name and number of products. Save keeps it, with the products that exist, and opens it in the form; ignore drops the offer. A recipe whose name is taken can only be ignored. The same code scanned again while it waits is one offer.
5. The history shows the scan as one line; one undo takes the whole recipe back.

### UC-25 Scan a recipe code with the phone camera

1. The user points the camera of the scan page at the code of a recipe.
2. The camera pauses and a sheet shows the recipe's name with every product ticked. A product that no longer exists is greyed and cannot be ticked.
3. The user unticks what is in the house and confirms. Only the ticked products go on the list, with a message and an undo as in UC-21. The history shows one line, from the phone.
4. For a recipe whose name the app does not have, the sheet has a box to keep the recipe. Ticked, the recipe is stored at once with the products that exist. Unticked, the recipe is offered in the inbox as in UC-24.
5. Closing the sheet adds nothing. The camera goes on either way, and reads the same code again only after three seconds.
6. A recipe code that cannot be read gives a message and nothing else.
7. Without a connection the sheet works the same; the addition waits as in UC-21.

### UC-22 Print recipe codes

1. The print button on a recipe's page prints its code.
2. On the Recipes tab, the choose button turns the rows into tick boxes. The print button, which shows how many are ticked, prints the codes of the ticked recipes; the cross leaves choosing.
3. The sheet is A4 with three codes across and four down, each 50 mm wide with the recipe's name below it. Short marks at the edge of the page show where to cut, so a cut-out code has no line on it. More than twelve go on to the next page. In the app on the home screen of an iPhone the button opens the share sheet with the sheet as pictures, one per page; Print is among its choices.
4. A code holds the recipe as it was saved. After a change to the recipe it has to be printed again.

## Oversight

### UC-9 Scan history

A page lists recent scans: time, source (handheld or phone), barcode, result (added, counted up, collected, not on the list, needs naming, ignored, undone). A recipe is one line with its name, how many products it put on the list and where it came from (the app, the phone or the handheld scanner); a tap shows those products with their quantities. It also undoes the last scan, a recipe as a whole, and it is the debugging view. A scan of a barcode that is still unnamed and whose lookup failed at a source carries a warning icon; tapping it opens the naming prompt, which can ask that source again.

### UC-10 Hands-off updates

1. A change is pushed to `master`.
2. GitHub Actions checks it and builds new images.
3. Within minutes the Pi pulls them and restarts the app, with no action from the user. Data survives the update, and open pages reconnect by themselves.
4. An open app, also one that was waiting in the background on the phone, reloads itself when the update changed the web app. It stays on the same page. While the user is typing, has a panel open or is scanning with the camera, it waits until the next change of page or the next return to the app.

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
2. On the sounds page, reached from the System page, each event shows its sound with a small timeline and a play button. A tap on the row opens a popup to pick another sound or "no sound"; the choice is saved and played at once on the buzzer.
3. A sound is made of blocks: beep, pause, trill (4 to 40 per second) and buzz (100 to 1000 per second), each with a duration, as many as fit in 1 second. Each kind looks different on the timeline: a sine for a beep, sine bursts for a trill, a sawtooth for a buzz, a flat line for a pause. In the editor popup the user names it, changes, adds, moves and removes blocks with sliders, plays it on the buzzer before saving, saves it, saves a copy as a new sound, named with "(kopie)" added, and goes on editing the copy with its name selected, or deletes it, after a confirmation, when no event uses it. A new sound made from an event's popup goes to that event.
4. The list of sounds below the events, folded until opened, plays each one and opens it for editing, to compare them and to check the buzzer works.
5. When a newer version goes live, the buzzer plays the sound chosen for "New version live" (by default short, short, long) once, as soon as the scanner service is connected to it. A restart of the same version, for instance after a reboot, stays silent, and so do a rollback to an older version, the way back from it to a version that was announced before, and a first install; "no sound" turns the announcement off.

### UC-18 Say what is wrong or missing

1. Anyone who is logged in can write a remark: a wish, a bug or a note. Three ways to start: the "Write" button on the Feedback row of the System page, a row that itself opens the Feedback page; pointing at a part of the app; or the Feedback page.
2. Pointing: "Point" on the System page puts a bar at the top, "Tap what you mean". The tabs keep working, so the user can walk to the page it is about: a tap on another tab navigates. The next tap on the page picks that part and does nothing else: a product is not checked off by it. A tap on the tab that is already active picks that tab, so the bottom menu can be pointed at too. A quicker way to pick a part at once on a computer: a right click, also on a tab. In a text field a right click keeps the browser's own menu. The hint under Feedback on the System page fits the device: on a touch screen (coarse pointer) it explains pointing and the active-tab tap, on a computer it names the right click first and pointing second.
3. The sheet says which part the remark is about, asks for the kind (wish, the leftmost, is the default) and the text, and sends it, also with Ctrl+Enter (Cmd+Enter on a Mac). Below the text are three buttons: close, which keeps the text for next time, the bin, which closes and clears it, and send. Escape and a click outside close it and keep the text. The app adds the page, the part pointed at, its version and a few facts about the device. It never adds what was typed in a field. The text may use markdown (bold, italic, strike-through, code, links, lists, headings, quotes, code blocks); the Feedback page shows it rendered. While typing, the field shows the plain text.
4. The writer gets a thank-you and nothing more: no promise and no state to follow. The remark is on the Feedback page, where each account sees its own.
5. Without a connection the remark is kept on the device and sent when the connection is back; the sheet says so.
6. The owner sees every remark on the Feedback page, is told about a new one from another account by a notification and a message on screen, and can mark a remark as handled (after a confirmation in a dialog, which Enter confirms) or reopen it. Handled remarks sit behind a "handled" item with their number, collapsed until it is tapped. Each remark shows what can be done with it at the top right: a single action as a button, two or more under a ⋮ menu (for the owner: send to GitHub, edit, handle or reopen, reject; for a writer: edit, reject).
7. The owner can edit the text and kind of any remark and a writer those of their own, until the remark is on GitHub; after that it is locked. Edit is in the remark's actions at the top right: the text turns into a field with Save (also Ctrl+Enter) and Cancel. The kind (bug, wish or note) is chosen in the same form, starting at the current one, and is saved with the text; the page and the part pointed at stay as written.
8. The owner can reject any remark and a writer can reject their own. After a confirmation the remark is hidden from the list for everyone; the row stays in the database (a soft delete, state `rejected`). A remark that is already on GitHub cannot be rejected.
9. The owner can send a remark to GitHub as an issue. The app first shows exactly what would be sent and warns that the repository is public. The first option, ticked by default, asks the agent on GitHub to handle it; the owner unticks it to send a plain issue. The account of the writer and the details of the device stay out unless the owner ticks them. When the agent is asked: the issue says it comes from the owner, the agent implements it in a pull request unless a question is open, and labels the issue with its verdict.
10. A remark that is on GitHub shows how far it has come on the Feedback page, under its issue link: sent and not picked up yet, the agent is looking at it, the agent has questions, too large (plan made), cannot be done, ready for review (with the number and title of the pull request, linked), merged but not in a release yet, released in a named version that this app does not run yet, live (the version this app runs contains it), or closed without a change. The page asks again every minute while it is open. When GitHub cannot be reached the last known state stays, or none is shown.
11. The owner sees how many remarks are still open and not on GitHub yet, as a number on the Feedback row of the System page and on the System tab. Other accounts see no number.

### UC-19 See what changed in each version

1. Every account that is logged in finds "What's new" in the "This device" group of the System page.
2. The page lists the releases, newest first. Each shows a summary line, the version and the date and time it was released.
3. A tap on a release opens its individual notes; a second tap closes them, and opening another closes the first.
4. The notes are the changes between a version and the one before it, in English, oldest first; the first is the summary. Versions from the first one onward are filled in, and each new version brings its own entry.

## Using it as an app

### UC-14 Install on the phone

The user adds the site to the home screen from the browser's share menu. It then opens full screen with its own icon and name, and can receive notifications.

### UC-17 Log in

1. Opening the site without a session shows a login page with one button, "Log in with Google".
2. The user picks a Google account. An account on the allowlist gets in and stays logged in on that device for 90 days, longer when the app is used.
3. Any other account is sent back with "this Google account has no access".
4. The System page shows the account and a red logout button, which asks for confirmation.

### UC-15 Language and appearance

The System page has three groups. "This device", for every account: Dutch or English, automatic, light or dark appearance (both remembered per device; the chosen appearance shows its name, the others only their icon), notifications for this device on or off, feedback and the changelog (UC-19). "Account": the address that is logged in and the logout button. "Management", for the owner only: whether the live connection is up, the handheld scanner, with its state ("connected") at the top right of its row next to the title and the time of its last scan below, and rows that open the products (UC-6), the sounds at the scanner, the scan history and the system log. The running version stands below it. The owner also gets the test notification button. Other accounts do not see the management group, and the server refuses them the data behind it.
