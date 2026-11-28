# Plan: recipe pictures and tiles

Item 9 of [plan.md](plan.md). Decided in [0129](decisions/0129-recipe-pictures.md) and [0130](decisions/0130-recipes-page-as-picture-tiles.md). Five parts, each leaving the app working, in this order.

## 1. `sharp` on the Pi

Tried before anything is built on it: in a throwaway container of the app's own image on the Pi, install `sharp` and shrink one JPEG. When that fails, the choice of [0129](decisions/0129-recipe-pictures.md) for the small picture goes back to the owner.

Done 2026-11-27 23:58: `sharp` 0.35.5 installed in nine seconds from its ready build for arm64, 20 MB with what it brings, and cut the Allerhande picture of 1224 by 900 to 600 by 400 in 121 milliseconds.

## 2. The API keeps pictures

- **Data**: the `recipe` table gets `picture` (a short mark that changes with the picture, empty without one) and `picture_source` (the address it came from, empty for an own picture), through a migration. The entity and the shared `Recipe` type get both.
- **Files**: `<data>/recipe-pictures/<recipe id>.jpg` and `<recipe id>-small.jpg`. The folder is a setting of `AppConfig` with that default. `RecipePictureService` owns the folder: it makes the two sizes with `sharp`, writes, reads and deletes. `RecipeService` stays the owner of the table and asks it.
- **Sizes**: the large one at most 1600 wide, the small one 600 by 450, the shape of a tile. JPEG, turned upright by the mark of the camera, nothing else of the file's own data kept.
- **Routes**, all for logged-in accounts:
    - `GET /api/v1/recipes/:id/picture?size=small|large`: the file, with a header that lets the browser keep it for a year; the web app puts the mark in the address.
    - `PUT /api/v1/recipes/:id/picture`: the body is the picture itself, at most 10 MB, of a kind `sharp` reads.
    - `DELETE /api/v1/recipes/:id/picture`.
- **The download**, a rule of its own with tests: `https` only, the name looked up first and refused when it points inside the home network or at the Pi itself, no following of a redirect to such a place, at most 10 MB and 10 seconds.
- **The import**: the question that reads the link asks for the address of the picture too, and `readPage` checks it is an `https` address. After the recipe is saved the picture is fetched; whatever goes wrong there is a line in the log and a recipe without a picture.
- **Deleting a recipe** deletes its files, after the row is gone.
- **Events**: a changed picture sends the `recipe` event that a changed recipe sends.
- **The backup**: `backup.sh` copies the folder into the backup repository beside the dump; `deployment.md` gets the folder, the setting and the step that puts the pictures back.
- **Tests**: the download rule, the service against a temporary folder, the routes over HTTP with a small picture made in the test, and the import with a stand-in for Gemini and for the download.
- **Trials**: the link read with the extra question, on the Allerhande links of the earlier trials and on two other sites, to see that the recipe text stays as good and the address is real.

Done 2026-11-28 00:04, except the trials: the import was not run against Gemini with the extra question, and no picture was downloaded by the app itself; the tests use a stand-in for both. The backup script was checked for its syntax only.

## 3. Tiles on the Recipes page

- The row becomes the tile of [0130](decisions/0130-recipes-page-as-picture-tiles.md): a grid of at least 150 pixels per tile, the small picture cropped to 4 to 3 with the cart button at its top right, and over its bottom the name and the icons of the products on a band.
- The band, its text colour and the filter on the picture are variables in `styles.css`; the themes that were approved with a value of their own get it in their file. The icons on a tile are drawn as a mask in the colour of the text.
- Without a picture: the placeholder, the category icon large on a surface of the theme.
- Select mode: a tap ticks the tile; the tick, or the warning of a recipe with a draft, where the button was.
- The recipe page shows the large picture above the text, and nothing in that place without one.
- With the tile on a phone, the width of the small picture is set.
- Tests: the page's own tests for tile, placeholder and select mode, and the end-to-end run reaches a tile.

Done 2026-11-28 00:38: the tile of [0130](decisions/0130-recipes-page-as-picture-tiles.md), the variables with a value of their own in 17 themes, the folded corner and the tilt in Sticky, and the large picture on the recipe page. Seen only as a drawing of the tile in all themes, made from the app's theme files; the page itself was not seen in a browser with a picture on it, and the end-to-end run has no recipe with a picture.

## 4. The owner's own picture

- The form of a recipe gets a picture button (choose or take one on the phone) and a remove button, both icons only.
- A new recipe has no id yet: the picture is sent after the recipe is saved.
- Tests for the form, and the end-to-end run uploads one.

Done 2026-11-28 00:50: the two buttons in the form, the picture sent after the recipe is saved, and a browser test that uploads one through the cut.

## 5. Choosing the cut

Asked for by the owner on 2026-11-27, as a maybe.

- After choosing a picture, a sheet shows it under a frame of 3 to 2. One finger moves it, two fingers or a slider enlarge it. The browser cuts it on a canvas and sends the result; the API needs nothing new.
- Written in the app itself, without a package, unless that turns out to be more than a small component.
- To decide with the owner when part 4 is seen: whether the cut is also offered for a picture that came from an import. That needs the picture as it was received kept as a third file, or the cut is made from the large one.

Done 2026-11-28 00:50: the sheet with the frame, one finger, two fingers and the slider, cut in the browser on a canvas, written in the app without a package. Tried in headless Chrome with the slider only; fingers on a real phone were not tried. The cut is offered for a picture that is chosen or taken, not for one that is already kept.

## After the first use (owner, 2026-11-28)

Done 2026-11-28 01:29:

- A finger on the picture in the cut sheet no longer scrolls the page behind it.
- The form takes the address of a picture: the API fetches it and the browser lays it under the cut.
- A message lies over an open sheet instead of behind it: the messages are shown in the browser's top layer, opened again with every new message.
- The import sheet shows a moving bar while it waits, and its field is closed meanwhile.
- Confirming or replacing a draft goes back to the inbox, and so does the back link of a draft's page.

Seen in the log of the Pi on 2026-11-28: of three imports of Allerhande links, one came with its picture. For the other two the link read gave the model a thinner page (about 3,600 and 10,800 tokens against 22,700) and no address of a picture came back. One import failed on Gemini itself: two answers that did not come within 25 seconds and one 503.

Found and done 2026-11-28 01:53: Gemini's link read gives the whole page of an Allerhande recipe, with the address of its picture, when the link is the short form `ah.nl/r/<number>`, and often a thin one without it for the long form. Asked three times for the long link of one recipe: no picture; twice for its short link: the picture both times. The import now reads an Allerhande recipe through its short link; the link that is kept with the recipe stays the one that was pasted. Tried on one recipe; confirmed by the owner on 2026-11-28 02:01 with an import through the app on 1.2.100, a second recipe, which came with its picture.

Done 2026-11-28 01:56 ([0131](decisions/0131-app-reads-a-recipe-page-itself.md)): the app reads a recipe page itself first. Run against one page each of Leukerecepten, Jumbo and BBC Good Food: the name, the servings, every ingredient line, the steps and the picture came out. No import through the app was done with it.

Done 2026-11-28 01:44: the import sheet reads the clipboard when it opens and fills its empty field with what was copied. An iPhone shows its own "Paste" bubble first, which the owner taps; a refusal leaves the field empty. A tile shows only whole product icons. Neither was seen on a phone.

## Left open

- **Without a connection**: the service worker keeps the app's own files and never touches API calls. Pictures under `/api` are kept by the browser's own store only, which an iPhone may empty. Whether the tiles need their pictures in the shop is seen in use.
- **Recipes that were imported before**: none with a link is left, so nothing is fetched afterwards.
