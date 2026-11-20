# Ideas

Ideas from the owner, written down on 2026-11-20 to send through the feedback button as a test of that path. Nothing here is decided or built. Three other ideas were built: that an approval merges and merges release, the same day as the release train ([0059](decisions/0059-release-train.md)), the split of the decisions into records ([index](decisions/README.md)), and a new version without a page load ([0100](decisions/0100-new-version-without-page-load.md)). Each idea has the text to paste as a remark (kind: wish; the first line becomes the issue title, at most 80 characters; the whole text at most 2000) and what was found in the code on that date.

When an idea is built or dropped, move its outcome to [decisions/](decisions/README.md) and [plan.md](plan.md) and remove it here.

## 2. Template and styling out of the component file

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
