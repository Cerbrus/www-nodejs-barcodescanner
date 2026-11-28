# 0131. The app reads a recipe page itself first, and Gemini reads it only when that fails

- Status: accepted
- Date: 2026-11-28
- Decided by: the owner
- Changes one part of [0122](0122-recipes-imported-with-gemini.md): Gemini's fetch tool is no longer the first to read a link

## Context

An import from a link let Gemini fetch the page ([0122](0122-recipes-imported-with-gemini.md)), because the site that was tried, Albert Heijn's, refuses a fetch from a server. With the picture of a recipe ([0129](0129-recipe-pictures.md)) that reading showed its limits. On 2026-11-28 the Pi's log held three imports of Allerhande links of which one came with a picture: for the others Gemini's reader gave the model a thin page, a quarter of the tokens, with no address of a picture in it. Asking again, for the picture alone, gave nothing three times. One import failed on two answers that did not come within 25 seconds and one 503.

What was found that day:

- A recipe page carries its recipe as `schema.org/Recipe` data, as [0122](0122-recipes-imported-with-gemini.md) noted, with the address of its picture, and most pages carry an `og:image` address for link previews.
- Fetched from the Pi under the app's own name, pages of Leukerecepten, Jumbo and BBC Good Food answered with that data: the name, the servings, every ingredient line, the steps and the picture.
- Albert Heijn's site answered 403, also under that name.
- Gemini's reader gives the whole page of an Allerhande recipe, with the picture, for the short link `ah.nl/r/<number>`: twice of two for a recipe whose long link gave a thin page three times of three.

## Options weighed

- **Gemini reads every link**, as it was.
- **The app reads the page first** and takes the recipe from the page's own data; Gemini reads the link when the site refuses the app or the page has no such data.
- **Getting past a site that refuses servers**, by naming the app as a browser or as a crawler for link previews. Not done: the site said no.
- **A second question to Gemini** for the picture alone. Tried: it sees no more the second time.

## Decision

**The app fetches the page of a link itself**, under its own name, with the guards of the picture download ([0129](0129-recipe-pictures.md)): `https` only, no address inside the home network, a limit in bytes and in time.

**It reads the page's own recipe data**: the name, the servings, the ingredient lines and the steps become the text that the model turns into rows, the same text Gemini's reader was asked to copy. The picture is the one of the recipe data, else the one for link previews.

**Gemini reads the link** when the page could not be fetched, or holds no recipe data with a name and ingredients. A preview picture the app did find is kept for when Gemini's reader gives none.

**An Allerhande link is read through its short form.** The link kept with the recipe is the one that was pasted.

**Nothing changes after the reading**: the model matches the lines to products, the app checks its answer ([0126](0126-app-checks-the-product-of-a-row.md)), and a failure saves nothing.

## Consequences

- An import from a site that lets the app in costs one question to Gemini instead of two, without the page of some 20,000 tokens, and does not wait for Gemini's reader.
- The recipe text of such a site is what the site wrote, not what a model copied: no line with a letter wrong.
- The app reads only the data a page offers for this; it does not guess a recipe from the page's words. That stays Gemini's work.
- The app names itself in the request. A site may refuse it; the import then goes on as before.
- The short link was tried on one recipe. When it stops giving the whole page, an Allerhande import is back to a recipe without a picture, and the field for a picture's address in the form remains.
