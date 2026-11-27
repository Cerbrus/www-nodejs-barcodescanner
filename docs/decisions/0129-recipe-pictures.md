# 0129. A recipe has a picture, kept by the app in two sizes and in the backup

- Status: accepted
- Date: 2026-11-27
- Decided by: the owner

## Context

The owner wants the picture of a recipe page kept with the imported recipe, and thinks of the Recipes page as tiles then ([0130](0130-recipes-page-as-picture-tiles.md)).

What was found on 2026-11-27:

- The Allerhande page refuses a plain fetch from the Pi and from a computer at home (status 403), so the app cannot read the address of the picture from the page itself.
- Gemini's link read, the one the import already uses ([0122](0122-recipes-imported-with-gemini.md)), gave the address of the picture when asked for it: the same address in two of two trials, a real JPEG of 1224 by 900 and 112 KB. The ask counted about 22,500 tokens, the same as the page read of the import, so the address can come along in that call.
- The host of the picture does not refuse the Pi: the download worked.
- The site has a smaller variant of the same picture under another name (445 by 297, 17 KB). That naming is the site's own.
- The content security policy already allows pictures from any `https:` host.
- The backup holds a dump of the database and no files.
- Tried on one recipe of one site only.

## Options weighed

- **Where the picture lives**: a copy kept by the app, or only its address with the phone loading it from the site.
- **The small picture for a tile**: the app shrinks the picture itself with the `sharp` package, one file that the browser scales, or a guess at the small variant of the site.
- **A recipe without a picture**: a placeholder with a picture of the owner's own, a placeholder only, or the own picture as a later part.
- **The backup**: pictures in it, or fetched again from their address after a restore.

## Decision

**A recipe has at most one picture.** The app keeps its own copy as files beside the database, and the address it came from in the database.

**Two sizes.** The app makes both from what it received, with `sharp`: a large one for the recipe page and a small one for a tile. Both are JPEG. The width of the small one is set when the tile exists.

**The import fetches it.** The question that reads the link also asks for the address of the main picture of the recipe. The API downloads that address itself. A page without a picture, an address that does not answer, a file that is no picture or one that is too large: the recipe is saved without a picture. A picture never fails an import.

**The owner's own picture.** The form of a recipe has a button to choose or take a picture on the phone, and one to remove the picture. An uploaded picture goes through the same step that makes the two sizes, and replaces the one from a site. Before the upload the owner chooses the cut: the picture lies under a frame in the shape of a tile and is moved and enlarged until the frame holds what the tile should show.

**Without a picture** a recipe shows a placeholder: a plain surface in a colour of the theme with the icon of its category.

**The backup holds the pictures**, as files beside the dump in the private repository. A site may remove or rename a picture, so a restore never counts on fetching one again from its address.

## Consequences

- A new package with a native part, `sharp`. Its ready build for the Pi's processor is tried on the Pi before anything is built on it.
- The `recipe` table gets columns for the picture, through a migration. The files live in a folder of their own under the data folder, which is not in git.
- The address of a picture comes from a web page, by way of a model. The download takes `https` addresses only, refuses an address inside the home network, has a limit in bytes and in time, and keeps nothing that `sharp` cannot read as a picture.
- Deleting a recipe deletes its files. A recipe saved from a scanned code has no picture: a recipe code does not carry one ([0100](0100-recipes-as-qr-codes.md)).
- The pictures are served by the API to logged-in accounts, with an address that changes when the picture does, so a browser may keep one for good.
- The backup script copies the folder of pictures; the restore procedure in the deployment doc puts it back.
- A picture of a site stays that site's picture. The app shows it to the accounts of one household and the repository of the backup is private.
- Asking for the address may make the link read answer less well; the trials of the import are done again with it.
