# Ideas

Three ideas from the owner, written down on 2026-11-20 to send through the feedback button as a test of that path. Nothing here is decided or built. A fourth idea, that an approval merges and merges release, was built the same day as the release train, see [decisions.md](decisions.md). Each idea has the text to paste as a remark (kind: wish; the first line becomes the issue title, at most 80 characters; the whole text at most 2000) and what was found in the code on that date.

When an idea is built or dropped, move its outcome to [decisions.md](decisions.md) and [plan.md](plan.md) and remove it here.

## 1. A new version without a page load

### Remark

```
Load a new version without reloading the page, so the camera is not asked again

After an update the app reloads the page. On the iPhone the camera permission belongs to the loaded page, so after every new version the scan page asks for the camera again.

Wish: take a new version into use without a page load, so a permission that was given stays. If that cannot be done safely, find the next best: reload less often, or only at a moment when it costs nothing.

- The app must never stay on a mix of old and new files.
- Typed text, an open dialog and a running camera stay untouched, as now.
- Offline shopping and the service worker's kept files must keep working.
- Say what was tested on a real iPhone and what was not.
```

### Found

- `UpdateService` compares the loaded script and style files with `/app-files.json` when the app comes back to the front and after a page change, and calls `window.location.reload()` when they differ. It waits while a field has focus, a dialog is open or the scan page is shown.
- The camera is opened on the scan page with `getUserMedia` through `@zxing/browser`. A grant is held by the document. Jumps between hash addresses keep the document, which is why moving between pages does not ask again; a reload makes a new document.
- Replacing the app inside the living document is possible in principle: destroy the Angular application, fetch the new `index.html`, add its script and style files, start the new application. The new files have new names, so the browser loads them as new modules. It is not something Angular supports: the old modules stay in memory, anything the old application left on `window` or `document` stays too, and the service worker must already hold the new files.
- Not checked: whether the iPhone keeps the camera grant across such a swap, and how often it asks again anyway after the app was closed. Both need a test on the device before any of this is built.
- Cheaper options: reload only at a cold start instead of every time the app comes to the front (the service worker keeps the old files, so an old version keeps running), or reload only when the new version changed the web app and not only the API or the agent.

### For the test

This changes how updates reach an open app. The expected verdict is "too large", with a plan in steps.

## 2. Decisions as separate records

### Remark

```
Split docs/decisions.md into one record per decision

docs/decisions.md has grown into one long page where a decision and its later changes sit in the same paragraph. Move to Architecture Decision Records in the MADR layout:

- One file per decision in docs/decisions/, numbered: 0001-own-shopping-list.md.
- Each with: status (accepted, superseded by NNNN, dropped), date, who decided, context, the options that were weighed, the decision, the consequences.
- A changed decision is a new record that supersedes the old one; the old one stays and points to it.
- docs/decisions/README.md is the index: number, title, status, date, grouped by subject. That page is what gets read first.
- Keep every decision and every date that is in decisions.md now. Lose nothing.

Then go through the app for choices that were made but never written down, and add a record for each, marked as found afterwards. Look in CLAUDE.md (code style, hard rules), architecture.md, deployment.md, the lint and build settings and the package list.

Update every link to decisions.md.
```

### Found

- The usual standard is the Architecture Decision Record (ADR): one short, numbered file per decision that is never rewritten, only superseded. Nygard's original layout has title, status, context, decision, consequences. MADR (Markdown Any Decision Records) adds the weighed options and a metadata block; it fits here because most entries already name what was chosen against.
- `decisions.md` is 173 lines with 21 numbered decisions in two tables and about 20 sections below them. Many hold a chain: "Decided", "Changed", "Changed again". Each link of such a chain becomes a record of its own.
- `CLAUDE.md` and `.github/issue-investigator.md` both tell the reader to read `docs/decisions.md` and to change it first. With records the instruction becomes: read the index, add a record. The whole set is larger than the page is now, so the index must be enough to work from.
- No tool is needed. `adr-tools` and Log4brains exist; they add little for one writer.

### For the test

The investigator may not change `CLAUDE.md` or `.github/issue-investigator.md`, so it should do the docs and name those two edits for the owner. The search for unwritten decisions is open-ended; it may come back as "too large" or as a first part.

## 3. Template and styling out of the component file

### Remark

```
Give every component its own template and style file

Many components carry their template and styling inside the .ts file. Move each to a file next to it: name.component.html and name.component.scss (name.page.html and name.page.scss for pages), with templateUrl and styleUrl, the way the scan page does it.

- All components and pages, the small ones too. No style file when there is no styling.
- No change in what the app shows or does; the tests stay green without being weakened.
- Add the lint rule that forbids inline templates and styles (@angular-eslint/component-max-inline-declarations with template 0 and styles 0), so it stays this way.
- Move the text as it is; do not reformat it beyond what Prettier asks for an .html file.
```

### Found

- 21 components and pages have an inline `template` or `styles`; 8 already use `templateUrl`, among them the scan page and the list page.
- `angular-eslint` 22 is installed and has the rule `component-max-inline-declarations`. It is not switched on.
- The web app's tests already run components with `templateUrl` (`scan.page.spec.ts`), so the test setup needs no change.
- Prettier uses the Angular parser for `.html` and `yarn lint:all` checks it, so a moved template is formatted by those rules from then on.
- `CLAUDE.md` should get a line for it under "Code style".

### For the test

A plain refactoring over about 40 files. The expected verdict is "implemented", with the `CLAUDE.md` line left to the owner.
