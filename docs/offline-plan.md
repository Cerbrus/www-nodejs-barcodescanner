# Plan: shopping without a connection

Status: proposal of 2026-11-13. Nothing is built. This is milestone 8 of [plan.md](plan.md).

## The problem

The list is used in the shop, where signal is often poor. Today the page needs the server for everything: without a connection the installed app opens to an empty list, and a tap on a tile is lost.

## What "offline" should mean here

In order of value:

1. **See the list.** The app opens and shows the list as it was when last seen, with a clear "not up to date" mark.
2. **Check off.** Taps on tiles work without a connection and are sent when it returns.
3. **Add from the catalog.** Putting a known product back on the list works the same way.
4. Not offline: scanning, naming barcodes, creating products, sounds, history, log. They need the server by nature, or are not done in a shop.

## How

```
            ┌──────────────── phone ────────────────┐
 server ◄──►│ page ◄──► outbox (pending changes)    │
            │   ▲                                   │
            │   └────── snapshot (last known data)  │
            │ service worker: app files from cache  │
            └────────────────────────────────────────┘
```

- **App files.** The service worker, which today only handles notifications, also keeps the built files of the web app and the icon images, so the app starts without a connection. New versions are picked up in the background and used at the next start.
- **Snapshot.** After every successful load the page stores sections, products, list entries and inbox in the browser's database (IndexedDB). At start it shows the snapshot at once and then loads fresh data; so it also starts faster with a connection.
- **Outbox.** A change made without a connection is applied to the list on screen and written to an outbox. When the connection returns, the outbox is sent in order, then the list is reloaded.
- **Conflicts.** One user and simple changes keep this small. Each queued change is a statement about one product ("to recent", "to buy, quantity 2", "note is ..."), sent with the time it was made. The server applies it unless the entry was changed later on the server; then the server's state wins and the page shows what happened. A handheld scan at home while the phone is offline in the shop is the realistic case: the scan and the check-off are both applied, in time order.
- **Login.** A session lasts 90 days, and the snapshot is only shown to a device that had a session. An expired session with a full outbox keeps the outbox until the next login.

## Steps

| Step | What | Size |
|---|---|---|
| 1 | Service worker caches the app files and icons; app starts offline to a "no data yet" page | medium |
| 2 | Snapshot in IndexedDB; list shows from the snapshot with a "last updated" mark | medium |
| 3 | Outbox for check-off, add and quantity; applied on screen at once, sent on reconnect | large |
| 4 | Server accepts changes with their time and resolves conflicts; tests for the time-order rules | medium |
| 5 | Tests on the phone in a real shop; documentation | owner |

Steps 1 and 2 already give "see the list in the shop" and can be released on their own.

## Risks

- **Stale app files.** A caching service worker can keep serving an old version. Covered by versioned file names, which the build already makes, a cache that is replaced per version, and the version on the System page.
- **iPhone specifics.** Storage of an installed web app can be cleared by the system after weeks without use; the snapshot is then simply loaded again. Background sync does not exist there, so the outbox is sent when the app is opened or comes to the front, not in the background.
- **Hash addresses and the notification tap** must keep working with the new service worker; the tap handling was hard-won (see decisions).

## Choices for the owner

1. Stop after step 2 (read-only offline) and see whether that is enough, or go on to the outbox at once? Recommendation: release steps 1 and 2 first.
2. Should a tap made offline look different, for instance a small clock on the tile until it is sent? Recommendation: yes.
3. When the server's state wins a conflict, show a message or stay silent? Recommendation: one quiet toast, "list updated from the server".
